# PRODUCT REQUIREMENTS DOCUMENT

| CODE | CAPSTONE_PRD |
| --- | --- |
| VERSION | 0.0.4 |
| STATUS | TEST |
| AUTHOR | HOANG MINH TUAN |
| VERIFY | HOANG MINH TUAN |
| UPDATE | 30/10/2026 |
| RELATED DOCUMENT | Project Brief CAPSTONE_PB v0.0.4; SDD CAPSTONE_SDD v0.0.5 |

| Phiên bản | Ngày | Người sửa | Nội dung thay đổi |
| --- | --- | --- | --- |
| 0.0.1 | 7/10/2026 | Hoang Minh Tuan | Khởi tạo tài liệu. |
| 0.0.2 | 7–8/10/2026 | Hoang Minh Tuan | Tách rõ MVP Sản Phẩm với MVP nghiên cứu bổ sung để tránh chồng lấn chức năng. Mở rộng phạm vi theo Project Brief 0.0.2: thêm Screener, Portfolio, Trade Plan, Journal, Chat, PDF, thông báo email/Telegram và ứng dụng mobile theo 3 giai đoạn; sửa các lỗi và mâu thuẫn nội bộ. |
| 0.0.3 | 9/10/2026 | Tran Trong Đai | Bổ sung thêm US-23: đăng nhập, đăng xuất, US-24; tự động cập nhật dự báo sau mỗi phiên giao dịch và US-25 xem lịch sử quản trị. Cập nhật các yêu cầu liên quan: FR (M0, M7); thêm AC-27 đến AC-30. Giảm số mã tối đa từ 30 xuống 10. Thêm FR-M7-09 hiển thị dữ liệu đầu vào FR-M7-10 chạy lại để tái lập theo US10. Thêm đặc tả use case cho US. |
| 0.0.4 | 29/10/2026 | Tran Trong Đai | Bổ sung luồng đăng ký và vòng đời tài khoản: quy tắc nghiệp vụ, căn cứ pháp lý, US-26..US-29, UC-26..UC-29, FR-M0-08..FR-M0-15, AC-31..AC-39, NFR-18; ràng buộc pháp lý C6 (Luật Bảo vệ dữ liệu cá nhân 2025, Nghị định 356/2025); sửa điều kiện trước của UC-12, UC-23; cập nhật §4.2, §6.1, §8, §16. NFR-07: băm mật khẩu bằng hàm băm chậm có salt (triển khai scrypt), phiên lưu dạng token băm. Rà soát 30/10/2026: sửa C4 theo ngăn xếp kỹ thuật (Node.js, React, PostgreSQL); viết lại FR-M0-06; thống nhất mức ưu tiên cảnh báo trong app và xem đầu vào, tái lập dự báo với US-10, AC-14; cập nhật A8 (hạn mức Gmail); FR-M5-07 thêm Admin để nhận thông báo lỗi pipeline qua email/Telegram. |

## 1. Tổng quan sản phẩm

IDSS (Investment Decision Support System; tên thương mại tạm: StockSense VN) là hệ thống web và ứng dụng mobile cho biết xác suất cổ phiếu HOSE/HNX (kèm một số mã UPCoM thanh khoản cao) tăng, đi ngang hay giảm sau 2 và 5 phiên (T+2, T+5), kèm lý do dự báo và lịch sử kiểm chứng, đồng thời giúp người dùng tự lập kế hoạch giao dịch, theo dõi danh mục và nhìn lại quyết định của mình. Lõi sản phẩm là một mô hình học sâu đa phương thức hợp nhất hai nhóm tín hiệu: đặc trưng định lượng (giá, khối lượng, chỉ báo kỹ thuật, chỉ số tài chính) và đặc trưng định tính (cảm xúc tin tức tiếng Việt).

**Đầu vào**: dữ liệu giá, báo cáo tài chính, tin tức theo mã; giao dịch, kế hoạch và ghi chú do người dùng tự nhập (hoặc import CSV).

**Đầu ra**: nhãn tăng/đi ngang/giảm, xác suất từng lớp, tối thiểu 3 yếu tố giải thích, trạng thái dữ liệu; kế hoạch giao dịch (Trade Plan), danh mục (Portfolio), nhật ký quyết định (Journal), báo cáo PDF và thông báo.

**Hình thức**: ứng dụng web responsive, tối ưu cho laptop, và ứng dụng mobile native iOS/Android (GĐ3); dự báo cập nhật mỗi ngày sau phiên (batch cuối ngày).

**Giai đoạn**: GĐ1 (tuần 1–12) là phần lõi để bảo vệ; GĐ2 (dự kiến tuần 13–20) là vòng quyết định, Chat, PDF và thông báo ngoài app; GĐ3 (dự kiến tuần 21–28) là ứng dụng mobile.

***Tuyên bố trách nhiệm: hệ thống là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư, không cam kết lợi nhuận và không tự động đặt lệnh. Trade Plan do người dùng tự lập; Chat hỏi đáp không đưa lệnh mua/bán; dự báo, tín hiệu, Trade Plan và nội dung Chat đều không phải tư vấn đầu tư.***

## 2. Bối cảnh & vấn đề

Thị trường Việt Nam có quy mô nhà đầu tư cá nhân lớn: tại ngày 31/01/2025, VSDC ghi nhận 9.312.987 tài khoản cá nhân trên tổng số 9.330.766 tài khoản giao dịch trong nước, tương ứng khoảng 99,81% số tài khoản.  Nhà đầu tư có thể tiếp cận bảng giá và biểu đồ qua nền tảng giao dịch/TradingView, dữ liệu doanh nghiệp–thị trường qua Vietstock, và tin tức qua CafeF hoặc các báo điện tử; một nghiên cứu tại Việt Nam đã sử dụng 69.947 bài viết từ CafeF, Thanh Niên, Vietstock và VnExpress để nghiên cứu quan hệ giữa tin tức và thị trường.  Điều này tạo ra chi phí tổng hợp thông tin và khiến việc kiểm chứng một tín hiệu theo cùng phương pháp trở nên khó khăn.

Rủi ro hành vi càng đáng chú ý khi các nghiên cứu về Việt Nam tìm thấy bằng chứng về herding và ảnh hưởng của tâm lý đến lợi suất/biến động, đặc biệt ở các trạng thái thị trường cực đoan.  Do đó, hệ thống đề xuất không thay thế các nền tảng hiện hữu mà tích hợp dữ liệu giá, chỉ số tài chính và cảm xúc tin tức thành tín hiệu xu hướng T+2/T+5 có xác suất, nguồn dữ liệu, giải thích và lịch sử kiểm chứng.

Tính khả thi kỹ thuật được củng cố bởi các nghiên cứu NLP tiếng Việt: PhoBERT đạt 93,12% độ chính xác trong một thí nghiệm phân loại tiêu đề tin tức chứng khoán ba nhãn với hơn 1.000 mẫu CafeF; đồng thời, nghiên cứu đa phương thức quốc tế ghi nhận mức cải thiện hiệu quả dự báo tới 5% khi kết hợp dữ liệu tài chính với tin tức và dữ liệu xã hội. Các kết quả này là cơ sở để kiểm nghiệm trên dữ liệu HOSE/HNX, không phải cam kết hiệu năng cho hệ thống.

## 3. Mục tiêu & chỉ số thành công

Sản phẩm thành công khi chứng minh được mô hình đa phương thức tốt hơn baseline một cách đo lường được, và người dùng tra cứu, hiểu, kiểm chứng dự báo trong vài giây. Các giá trị đánh dấu *(cần xác nhận)* là mức đề xuất khi Project Brief chưa nêu số.

### 3.1. Mục tiêu nghiên cứu

| # | Mục tiêu | KPI | Ngưỡng đạt |
| --- | --- | --- | --- |
| R1 | Mô hình đa phương thức tốt hơn baseline định lượng | Macro F1 trên tập test (T+2 và T+5) | Cao hơn baseline tốt nhất ≥ 3 điểm phần trăm tuyệt đối (cần xác nhận) |
| R2 | Vượt mức ngẫu nhiên và mức “dự báo lớp phổ biến nhất” | Macro F1, AUC-ROC (one-vs-rest) | Macro F1 ≥ 0,40; AUC macro ≥ 0,60 (cần xác nhận) |
| R3 | Chứng minh đóng góp của cảm xúc tin tức | Ablation 3 cấu hình: chỉ định lượng / chỉ văn bản / kết hợp | Cấu hình kết hợp tốt nhất trên ít nhất 1 trong 2 kỳ hạn |
| R4 | Đánh giá không rò rỉ dữ liệu | Walk-forward theo thời gian, cut-off tin 15:00 | 100% thí nghiệm dùng chia tập theo thời gian |
| R5 | Bộ dữ liệu hợp nhất | Số mã, số năm lịch sử | ≥ 15 mã HOSE/HNX/UPCoM, ≥ 3 năm lịch sử |

### 3.2 Mục tiêu sản phẩm

| # | Mục tiêu | KPI | Ngưỡng đạt |
| --- | --- | --- | --- |
| P1 | Tra cứu dự báo nhanh | Thời gian hiển thị dự báo T+2/T+5 cho một mã | < 3 giây (p95) |
| P2 | Dự báo luôn có giải thích | % dự báo có xác suất + ≥ 3 yếu tố giải thích | 100% (trừ khi dữ liệu thiếu, hiển thị trạng thái thay thế) |
| P3 | Người dùng hiểu dự báo | % người thử trả lời đúng “mã này đang dự báo gì và vì sao” sau 2 phút | ≥ 80% trên 8–10 người thử (cần xác nhận) |
| P4 | Theo dõi lịch sử tín hiệu dễ dàng | Mỗi mã có trang lịch sử dự báo và hit rate | 100% mã trong phạm vi |
| P5 | Khả dụng | % ngày giao dịch có dự báo mới trước 20:00 | ≥ 95% trong giai đoạn demo |
| P6 | Độ hài lòng | SUS (System Usability Scale) | ≥ 68 (cần xác nhận) |
| P7 | Hoàn thành vòng quyết định | % người thử hoàn thành luồng dự báo → Trade Plan → đóng kế hoạch → Journal; % Trade Plan đã đóng có bản ghi Journal | ≥ 70% người thử hoàn thành trong 10 phút (cần xác nhận); 100% kế hoạch đã đóng có Journal (GĐ2) |
| P8 | Chat trung thực | % câu trả lời có số liệu đúng và có trích dẫn trên bộ kiểm thử chống bịa; % yêu cầu đưa lệnh bị từ chối | ≥ 95% (cần xác nhận); 100% (GĐ2) |
| P9 | Thông báo ngoài app đúng hạn | % cảnh báo email/Telegram tới trong 5 phút sau khi batch xong và không bị gửi trùng | ≥ 95% (cần xác nhận); 0 tin trùng (GĐ2) |
| P10 | Mobile dùng được | % kịch bản cốt lõi (xem dự báo, watchlist, Portfolio, Trade Plan) hoàn tất trên iOS và Android | 100% trên cả hai nền tảng (GĐ3) |

### 3.3 Giới hạn mục tiêu

Không đặt mục tiêu lợi nhuận giao dịch; backtest chỉ để kiểm chứng tín hiệu, không phải cam kết hiệu quả đầu tư.

Lãi/lỗ hiển thị trong Portfolio và Journal chỉ để người dùng tự theo dõi; không phải chỉ số thành công của sản phẩm và không dùng để chứng minh hiệu quả của dự báo.

Không đặt mục tiêu số lượng người dùng thật; đây là sản phẩm demo học thuật.

## 4. Đối tượng người dùng & persona

Ba nhóm chính cần cùng một dự báo nhưng khác nhau về độ sâu giải thích: nhà đầu tư cá nhân cần tín hiệu rõ và ít thuật ngữ, swing trader cần tốc độ và độ tin cậy, analyst cần truy vết đến từng đặc trưng. Nhà đầu tư cá nhân là nhóm ưu tiên vì chiếm ~99,8% tài khoản; swing trader và analyst khớp nhất với kỳ hạn T+2/T+5. Với các module quyết định (Portfolio, Trade Plan, Journal), retail dùng bản rút gọn, trader và analyst dùng bản đầy đủ.

### 4.1 So sánh ba persona chính

| Tiêu chí | P1 – Nhà đầu tư cá nhân (“Anh Minh”) | P2 – Swing trader (“Chị Lan”) | P3 – Analyst / quant (“Anh Huy”) |
| --- | --- | --- | --- |
| Hồ sơ | 22–45 tuổi, nhân viên văn phòng ở đô thị, đầu tư bán thời gian, kinh nghiệm mới – trung bình | 25–45 tuổi, theo dõi thị trường hằng ngày, nắm giữ vài phiên đến vài tuần | Chuyên viên phân tích tại CTCK, quỹ hoặc nhóm đầu tư; biết Python/SQL |
| Mục tiêu | Lọc nhanh vài mã đáng chú ý mà không mất nhiều giờ đọc tin | Bắt cơ hội ngắn hạn sớm, giảm lệnh sai | Đánh giá một tín hiệu có đáng tin không trước khi đưa vào báo cáo/khuyến nghị |
| Quyết định cần ra | Có đưa mã vào danh sách theo dõi hay tìm hiểu thêm không; nếu quyết định giao dịch thì ghi lại kế hoạch đơn giản và nhìn lại sau đó | Vào/ra/giữ vị thế trong 2–5 phiên; vào bao nhiêu, cắt lỗ ở đâu; có làm đúng kế hoạch đã lập không | Mô hình/tín hiệu có đủ tin cậy để dùng; vì sao mô hình sai; danh mục hoặc kế hoạch hiện tại có đang đi ngược tín hiệu không |
| Dữ liệu họ tin | Bảng giá CTCK, tin CafeF, lời khuyên người quen | Biểu đồ kỹ thuật, khối lượng, dòng tiền, tin nóng | Báo cáo tài chính, dữ liệu gốc có nguồn, kết quả kiểm định thống kê |
| Mức chấp nhận rủi ro | Thấp – trung bình | Trung bình – cao | Không trực tiếp giao dịch; ngại rủi ro mô hình |
| Mức hiểu tài chính | Cơ bản | Khá về kỹ thuật, cơ bản về cơ bản DN | Cao, cả tài chính lẫn thống kê/ML |
| Mức cần giải thích | Đơn giản: 3 lý do bằng lời, không thuật ngữ | Trung bình: nhóm yếu tố + hit rate lịch sử | Chi tiết: đóng góp từng đặc trưng, phiên bản mô hình, snapshot dữ liệu |
| Pain points | Quá tải thông tin; không phân biệt tin thật/tin đồn; sợ thuật ngữ | Phải canh nhiều mã cùng lúc; tín hiệu kỹ thuật hay nhiễu; không biết tín hiệu từng đúng bao nhiêu | Mô hình “hộp đen”; không tái lập được kết quả; dữ liệu không rõ nguồn và thời điểm |
| Hành vi sử dụng | 1–2 lần/ngày, buổi tối hoặc trước phiên, 5–10 phút | Nhiều lần/ngày, chủ yếu qua watchlist và cảnh báo | Theo phiên làm việc 30–60 phút, đào sâu từng mã |
| Tính năng quan trọng nhất | Forecast card, giải thích đơn giản, tin liên quan; Trade Plan, Portfolio, Journal bản rút gọn; Chat hỏi đáp | Watchlist, cảnh báo (kể cả email/Telegram), so sánh T+2/T+5, hit rate; Screener; Trade Plan đầy đủ (khối lượng, R:R); Portfolio, Journal | Analyst mode, đóng góp đặc trưng, so sánh mô hình, audit log; Screener; đối chiếu Portfolio/Trade Plan với dự báo; xuất PDF |
| Phiên bản module quyết định | Bản rút gọn: Portfolio nhập tay; Trade Plan 4 trường (giá vào, cắt lỗ, mục tiêu, lý do); Journal ghi chú; Screener theo bộ lọc có sẵn | Bản đầy đủ: import CSV, tính khối lượng theo mức rủi ro và R:R, snapshot dự báo, thống kê nhìn lại, lưu bộ lọc Screener | Bản đầy đủ như trader, thêm Analyst mode và truy vết (audit) |
| Vai trò hệ thống | retail | trader | analyst |

### 4.2 Người dùng mở rộng

**Môi giới chứng khoán:** chuẩn bị danh sách mã cần theo dõi và hỗ trợ trao đổi với khách hàng; dùng vai trò trader hoặc analyst, không coi dự báo là khuyến nghị mua/bán.

**Quản lý danh mục / phòng đầu tư:** dùng tín hiệu như lớp sàng lọc và cảnh báo rủi ro cho danh mục nhiều mã; dùng vai trò trader hoặc analyst với Portfolio, Screener và cảnh báo.

**Quản trị viên (admin):** không phải người dùng nghiệp vụ; quản lý tài khoản, phân quyền, nguồn dữ liệu, phiên bản mô hình và nhật ký.

**Hội đồng chấm đồ án:** đọc trang đánh giá mô hình và xem demo; dùng tài khoản demo tạo sẵn trước buổi bảo vệ (dữ liệu mẫu, không chứa dữ liệu cá nhân thật), hoặc tự đăng ký một tài khoản mới để xem luồng đăng ký.

**Cách có tài khoản theo vai trò** (quy tắc chi tiết ở §9.2.6, UC-26..UC-29):

| Vai trò | Cách có tài khoản | Ai quyết định |
| --- | --- | --- |
| retail | Tự đăng ký công khai bằng email và mật khẩu, xác thực email, tự khai đủ 18 tuổi | Không cần duyệt |
| trader | Tài khoản retail tự nâng cấp trong Cài đặt (khai kinh nghiệm, mục đích, xác nhận trách nhiệm); tự hạ cấp được | Tự động, có xác nhận |
| analyst | Tài khoản retail hoặc trader gửi yêu cầu (tổ chức, chức danh, email cơ quan, mục đích) | Admin duyệt |
| admin | Không đăng ký công khai: Admin đầu tiên tạo bằng lệnh bootstrap khi triển khai; Admin tiếp theo do Admin hiện có tạo | Người triển khai / Admin |

## 5. Giá trị cốt lõi

Giá trị cốt lõi là một dự báo duy nhất hợp nhất giá, tài chính và tin tức, có xác suất, có lý do và có lịch sử đúng/sai công khai, cùng một vòng quyết định (kế hoạch, danh mục, nhật ký) để người dùng tự nhìn lại quyết định của mình.

| Tiêu chí | Tự làm thủ công | Công cụ phổ biến (bảng giá, TradingView, báo tài chính, khuyến nghị CTCK) | IDSS |
| --- | --- | --- | --- |
| Hợp nhất nguồn | Tự mở 3–5 trang, tự ghép | Mỗi công cụ một loại dữ liệu | Giá + chỉ số tài chính + cảm xúc tin trong một màn hình |
| Đọc tin tức | Đọc từng bài, cảm tính | Không lượng hóa | Chấm cảm xúc tự động bằng mô hình tiếng Việt, gắn theo mã và ngày |
| Dạng tín hiệu | Cảm nhận | Chỉ báo rời hoặc “MUA/BÁN” không xác suất | Nhãn + xác suất 3 lớp cho T+2 và T+5 |
| Giải thích | Không nhất quán | Hiếm khi có | Tối thiểu 3 yếu tố, mức độ theo persona |
| Kiểm chứng | Không ghi lại | Không công bố tỷ lệ đúng | Lịch sử dự báo, hit rate, precision theo lớp |
| Truy vết | Không | Không | Mỗi dự báo gắn timestamp, phiên bản mô hình, snapshot dữ liệu |
| Quyết định và nhìn lại | Ghi sổ hoặc bảng tính, dễ quên lý do vào lệnh | Ghi chú tách rời, không gắn với dự báo tại thời điểm quyết định | Trade Plan gắn snapshot dự báo lúc lập kế hoạch (không sửa được); Journal tự tạo khi đóng kế hoạch và so sánh quyết định với dự báo |

Về học thuật, đóng góp là bằng chứng định lượng (ablation) về giá trị của cảm xúc tin tiếng Việt trong dự báo xu hướng ngắn hạn trên HOSE/HNX.

## 6. Phạm vi / ngoài phạm vi

Sản phẩm triển khai theo 3 giai đoạn. GĐ1 (MVP, 12 tuần) gói gọn trong một dashboard web cho 15 mã, hai kỳ hạn T+2/T+5 và dự báo cuối ngày, là phần lõi để bảo vệ. GĐ2 thêm vòng quyết định (Screener, Portfolio, Trade Plan, Journal), Chat hỏi đáp, xuất PDF và thông báo email/Telegram; GĐ3 thêm ứng dụng mobile native. Tám tính năng mới này là Must-have của giai đoạn tương ứng; các mục còn lại xếp vào Should-have hoặc Nice-to-have.

### 6.1 Ưu tiên tính năng

| Mức | Tính năng | Module | Giai đoạn |
| --- | --- | --- | --- |
| Must-have (MVP) | Dashboard/Market overview (danh sách mã + tín hiệu mới nhất) | M1 | GĐ1 |
| Must-have (MVP) | Forecast card và trang chi tiết mã (forecast + chart + tín hiệu + lịch sử ngắn) | M2 | GĐ1 |
| Must-have (MVP) | Giải thích cơ bản (3 yếu tố, nhóm tài chính / kỹ thuật / tin tức) | M3 | GĐ1 |
| Must-have (MVP) | Tin tức và cảm xúc theo mã | M4 | GĐ1 |
| Must-have (MVP) | Watchlist cơ bản (thêm/xóa, xem tín hiệu) | M5 | GĐ1 |
| Must-have (MVP) | Lịch sử dự báo và backtest cơ bản (hit rate, số mẫu) | M6 | GĐ1 |
| Must-have (MVP) | Trang đánh giá mô hình (metrics, confusion matrix, ablation) | M6, M7 | GĐ1 |
| Must-have (MVP) | Hiển thị thời điểm cập nhật | M1, M2 | GĐ1 |
| Must-have (MVP) | Đăng nhập, phân quyền retail/trader/analyst/admin | M0 | GĐ1 |
| Must-have (MVP) | Tự đăng ký tài khoản retail, xác thực email, ghi nhận đồng ý điều khoản và xử lý dữ liệu | M0 | GĐ1 |
| Must-have (MVP) | Vòng đời vai trò: tự nâng/hạ cấp Trader, yêu cầu Analyst do Admin duyệt, bootstrap Admin, tự xóa tài khoản | M0 | GĐ1 |
| Should-have | Tăng cường bảo vệ tài khoản: TOTP và nhập lại mật khẩu cho Admin, xác nhận email cơ quan, captcha, đồng ý lại khi đổi phiên bản văn bản | M0 | GĐ2 |
| Must-have (MVP) | So sánh T+2 với T+5 cạnh nhau | M2 | GĐ1 |
| Must-have (MVP) | Đóng góp đặc trưng chi tiết cho analyst (top 15 đặc trưng) | M3 | GĐ1 |
| Must-have (MVP) | Audit log cơ bản cho dự báo và lần chạy mô hình | M7 | GĐ1 |
| Must-have (MVP) | Cảnh báo trong app khi tín hiệu đổi hoặc xác suất vượt ngưỡng | M5 | GĐ1 |
| Must-have (MVP) | Analyst mode: xem dữ liệu đầu vào và tái lập một dự báo, so sánh mô hình | M3, M6, M7 | GĐ1 |
| Should-have | Chọn phiên bản mô hình đang phục vụ và rollback | M7 | GĐ1 |
| Should-have | Dải thị trường, khối “tín hiệu đổi hôm nay”, mức tin cậy, khối “điều gì có thể làm dự báo sai”, hiệu chỉnh xác suất | M1, M2, M6 | GĐ2 |
| Must-have | Screener sàng lọc cổ phiếu theo tín hiệu dự báo | M8 | GĐ2 |
| Must-have | Portfolio (nhập tay hoặc import CSV) | M9 | GĐ2 |
| Must-have | Trade Plan do người dùng tự lập | M10 | GĐ2 |
| Must-have | Journal nhật ký và nhìn lại quyết định | M11 | GĐ2 |
| Must-have | Chat hỏi đáp dựa trên dữ liệu hệ thống, kèm bộ kiểm thử chống bịa | M12 | GĐ2 |
| Must-have | Xuất báo cáo PDF | M13 | GĐ2 |
| Must-have | Thông báo qua email/Telegram | M5 | GĐ2 |
| Must-have | Ứng dụng mobile native iOS/Android | M14 | GĐ3 |
| Nice-to-have | Tối ưu danh mục | M9 (mở rộng) | Sau GĐ3 |
| Nice-to-have | Broker workspace | M7, M9 (mở rộng) | Sau GĐ3 |
| Nice-to-have | API public | Lớp API của M1–M14 | Sau GĐ3 |

### 6.2 Ngoài phạm vi

Tự động đặt lệnh hoặc tích hợp trực tiếp với hệ thống giao dịch của CTCK; giao dịch thật. Portfolio chỉ nhập tay hoặc import CSV, không kết nối API công ty chứng khoán.

Cam kết lợi nhuận, tư vấn đầu tư cá nhân hóa hoặc đảm bảo độ chính xác.

Toàn bộ thị trường (kể cả toàn sàn UPCoM; chỉ một số mã UPCoM thanh khoản cao được chọn vào danh sách theo dõi), phái sinh, chứng quyền, trái phiếu, quỹ, thị trường quốc tế.

Dữ liệu tick-by-tick, giao dịch tần suất cao, suy luận thời gian thực mức mili-giây.

Social trading, diễn đàn, sao chép lệnh.

Chatbot tư vấn đầu tư (đưa khuyến nghị mua/bán hoặc tư vấn cá nhân hóa). Chat hỏi đáp dựa trên dữ liệu của hệ thống (M12) thuộc phạm vi.

Dữ liệu trả phí quy mô doanh nghiệp chưa có bản quyền.

Lưu ý: Project Brief 0.0.2 đưa ứng dụng mobile native vào phạm vi ở GĐ3 (Must-have, module M14, xem mục 6.1); PRD này khớp theo Brief. Ứng dụng viết bằng React Native và dùng chung API với web.

## 7. Giả định & ràng buộc

Dự án giả định dữ liệu công khai đủ cho 15 mã trong 3 năm; ràng buộc chặt nhất là thời gian (GĐ1 12 tuần, tổng khoảng 28 tuần với GĐ2–GĐ3, một người thực hiện) và chi phí hạ tầng cho Chat và mobile từ GĐ2.

### 7.1 Giả định

A1. Tin tức theo mã trên CafeF thu thập được lùi về ít nhất 3 năm (chưa kiểm chứng độ sâu lịch sử).

A2. Giá ngày đã điều chỉnh lấy được từ nguồn công khai (SSI iBoard hoặc vnstock); báo cáo tài chính quý lấy được qua vnstock hoặc tương đương.

A3. Tự gán nhãn được 2.000–3.000 tin để tinh chỉnh mô hình cảm xúc tiếng Việt.

A4. Người dùng truy cập sau phiên; dự báo cập nhật một lần/ngày là đủ cho kỳ hạn T+2/T+5.

A5. Có GPU (Colab/Kaggle hoặc máy cá nhân) để huấn luyện; suy luận chạy được trên CPU.

A6. Chat dùng mô hình ngôn ngữ chạy cục bộ (mô hình nhỏ mã nguồn mở) hoặc gọi API trả phí theo lượt dùng; chưa chốt. Trong cả hai trường hợp, mô hình chỉ diễn đạt dữ liệu truy xuất từ hệ thống, không tự suy diễn dự báo.

A7. Telegram Bot API miễn phí và đủ cho lượng thông báo của bản demo; người dùng tự liên kết tài khoản Telegram bằng bot.

A8. Email gửi qua SMTP miễn phí là đủ cho số người dùng thử; bản demo dùng Gmail SMTP với App Password, hạn mức khoảng 500 người nhận mỗi ngày.

A9. Ứng dụng mobile phát hành thử nghiệm (TestFlight cho iOS, bản cài đặt trực tiếp cho Android); đưa lên App Store/Google Play chỉ khi có ngân sách và thời gian.

A10. Dữ liệu danh mục, kế hoạch và nhật ký trong bản demo là dữ liệu mẫu hoặc do người thử tự nhập; không nhập thông tin tài khoản chứng khoán thật.

### 7.2 Ràng buộc

C1. Thời gian: GĐ1 là 12 tuần từ khởi động đến bản demo bảo vệ lõi; GĐ2 dự kiến tuần 13–20 và GĐ3 dự kiến tuần 21–28; một sinh viên thực hiện. Nếu không tăng nhân sự, lộ trình đến tuần 28 cần được giảng viên hướng dẫn/hội đồng chấp thuận.

C2. Chi phí: GĐ1 gần 0 đồng, chỉ dùng dữ liệu và hạ tầng miễn phí. GĐ2–GĐ3 có thể phát sinh chi phí mô hình ngôn ngữ (nếu dùng API), hosting và tài khoản nhà phát triển Apple; cần chốt ngân sách trần (xem mục 16.1).

C3. Pháp lý: tuân thủ điều khoản sử dụng của nguồn tin; chỉ lưu tiêu đề, tóm tắt, URL và điểm cảm xúc khi hiển thị, không tái xuất bản toàn văn.

C4. Kỹ thuật: Node.js (Fastify) cho API và worker dữ liệu, React + Vite cho web, PostgreSQL; mô hình học máy (cảm xúc, dự báo, giải thích) viết bằng Python, chạy như một worker riêng và trao đổi với hệ thống qua CSDL. Nguồn dữ liệu kế thừa từ DATN_2026: giá SSI, tin CafeF (bổ sung VnExpress).

C5. Không phải sản phẩm thương mại; mọi màn hình dự báo, Trade Plan, cửa sổ Chat và báo cáo PDF phải có tuyên bố “chỉ mang tính tham khảo”.

C6. Dữ liệu cá nhân: tuân thủ Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15) và Nghị định 356/2025/NĐ-CP (thay thế Nghị định 13/2023), cùng hiệu lực từ 01/01/2026. Thu thập tối thiểu (chỉ email, mật khẩu, tên hiển thị tùy chọn); đồng ý điều khoản và xử lý dữ liệu tách riêng, có lưu bằng chứng (loại văn bản, phiên bản, thời điểm, kênh); người dùng tự xóa được tài khoản; chỉ nhận người tự khai đủ 18 tuổi (Bộ luật Dân sự 2015). Bắt buộc pháp chế xác nhận các điểm dưới đây trước khi mở cho người dùng thật.

**Căn cứ pháp lý của luồng đăng ký** (tổng hợp tham khảo, không phải tư vấn pháp lý):

| Văn bản | Nội dung liên quan | Áp dụng vào hệ thống |
| --- | --- | --- |
| Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15), hiệu lực 01/01/2026 | Cơ sở xử lý dữ liệu, sự đồng ý hợp lệ, quyền của chủ thể (truy cập, chỉnh sửa, xóa, rút lại đồng ý), nghĩa vụ của bên xử lý | Màn đồng ý khi đăng ký; xem lịch sử đồng ý; tự xóa tài khoản |
| Nghị định 356/2025/NĐ-CP, hiệu lực 01/01/2026, thay thế Nghị định 13/2023 | Phải lưu bằng chứng đồng ý; quy định riêng cho dữ liệu tài chính (mục đích, thời gian lưu, nguồn thu thập, bên chia sẻ); thông báo vi phạm trong 72 giờ với dữ liệu nhạy cảm; đầu mối bảo vệ dữ liệu; đánh giá tác động | Bản ghi đồng ý có phiên bản; thông báo xử lý dữ liệu; quy trình sự cố; chỉ định đầu mối |
| Luật Chứng khoán 2019 | Tư vấn chứng khoán gồm phân tích và khuyến nghị mua, bán, nắm giữ (Điều 4); cấm cung cấp dịch vụ chứng khoán khi chưa được cấp phép | Giữ tuyên bố "không phải tư vấn đầu tư" (C5); môi giới không dùng dự báo như khuyến nghị gửi khách hàng; Chat không đưa lệnh |
| Bộ luật Dân sự 2015 | Năng lực hành vi dân sự đầy đủ từ đủ 18 tuổi | Tự khai đủ 18 tuổi khi đăng ký |
| Luật Giao dịch điện tử 2023 | Giao dịch và đồng ý bằng thông điệp dữ liệu | Đồng ý bằng ô tick và lưu bằng chứng điện tử |

Điểm cần pháp chế xác nhận:

- Ngưỡng tuổi và đồng ý của người đại diện với trẻ em theo luật mới. Hiện hành: chỉ nhận người tự khai đủ 18 tuổi.
- Thời hạn xử lý yêu cầu của chủ thể dữ liệu (một số nguồn ghi khoảng 30 ngày, cần đối chiếu văn bản gốc).
- Dữ liệu Portfolio, Trade Plan, Journal do người dùng tự nhập có thuộc nhóm dữ liệu tài chính theo Nghị định 356 hay không. Hiện hành: xử lý theo mức nghiêm ngặt nhất (chỉ chủ sở hữu xem, Admin không xem, xóa theo yêu cầu).
- Chuyển dữ liệu ra nước ngoài khi dùng API mô hình ngôn ngữ, SMTP, Telegram có phải lập hồ sơ đánh giá hay không (mặc định không gửi dữ liệu cá nhân qua API ngoài; SMTP chỉ nhận địa chỉ email và nội dung thư hệ thống).
- Bản demo học thuật dùng dữ liệu mẫu (A10) có thể nhẹ nghĩa vụ hơn; mở cho người dùng thật thì phải tuân thủ đầy đủ.

## 8. User flows chính

Năm luồng chính: ba luồng đầu tương ứng ba persona (luồng 1 kết thúc ở watchlist, cũng là điểm bắt đầu của luồng 2); luồng 4 (GĐ2) là vòng quyết định dự báo → Trade Plan → giao dịch → Journal; luồng 5 (GĐ2) là nhận thông báo ngoài app.

5 user flow chính (3 luồng theo persona, vòng quyết định và thông báo ngoài app)

**Luồng 6 (GĐ1) — Đăng ký và vòng đời tài khoản:** Đăng ký (email, mật khẩu, 3 ô đồng ý) → nhận thư và bấm liên kết xác thực → đăng nhập với vai trò retail → (tùy chọn) tự nâng cấp Trader trong Cài đặt, phiên bị thu hồi và đăng nhập lại → (tùy chọn) gửi yêu cầu quyền Analyst → Admin duyệt hoặc từ chối → đăng nhập lại với vai trò mới. Nhánh: email đã tồn tại → vẫn thông điệp chung, chủ email nhận thư "Bạn đã có tài khoản"; chưa xác thực → không đăng nhập được, gửi lại thư; bị từ chối → nộp lại sau 7 ngày; người dùng có thể tự xóa tài khoản.

Nhánh ngoại lệ chung cho cả năm luồng: khi thiếu dữ liệu, forecast card hiển thị trạng thái dữ liệu thay cho phần giải thích của nhóm bị thiếu (FR-M3-04). Luồng admin (kiểm tra nguồn dữ liệu → xem lần chạy pipeline → đổi phiên bản mô hình) là luồng phụ, mô tả ở M7. Ở luồng 4, bước giao dịch do người dùng tự thực hiện tại công ty chứng khoán, ngoài hệ thống; người dùng ghi kết quả vào Portfolio và đóng Trade Plan để tạo Journal.

## 9. Use cases / User stories

### 9.1. User stories

Mỗi story có mã để truy vết sang functional requirement (mục 10) và acceptance criteria (mục 13).

| Mã | Persona | User story | Ưu tiên | FR liên quan |
| --- | --- | --- | --- | --- |
| US-01 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn thấy tín hiệu T+2 đơn giản của các mã để nhanh chóng lọc ra vài mã đáng chú ý. | Must | FR-M1-01..04 |
| US-02 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn đọc 3 lý do bằng lời dễ hiểu để biết vì sao hệ thống dự báo như vậy. | Must | FR-M3-01, FR-M3-03 |
| US-03 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn xem các tin mới nhất về mã kèm sắc thái để không phải tự đọc từng bài. | Must | FR-M4-01..03 |
| US-04 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn thêm mã vào watchlist để lần sau mở lại nhanh. | Must | FR-M5-01 |
| US-05 | Swing trader | Là swing trader, tôi muốn nhận cảnh báo khi tín hiệu đổi từ đi ngang sang tăng để phản ứng nhanh hơn. | Must | FR-M5-02..05 |
| US-06 | Swing trader | Là swing trader, tôi muốn so sánh T+2 với T+5 cạnh nhau để biết tín hiệu ngắn và dài hơn có đồng thuận không. | Must | FR-M2-05 |
| US-07 | Swing trader | Là swing trader, tôi muốn lọc danh sách theo sàn, ngành, thanh khoản và xu hướng để sàng lọc nhanh. | Must | FR-M1-02 |
| US-08 | Swing trader | Là swing trader, tôi muốn xem hit rate lịch sử của tín hiệu từng mã để biết có nên tin tín hiệu hay không. | Must | FR-M6-01..03 |
| US-09 | Analyst | Là analyst, tôi muốn xem đóng góp từng đặc trưng sau một dự báo để đánh giá dự báo có đáng tin không. | Must | FR-M3-02 |
| US-10 | Analyst | Là analyst, tôi muốn xem dữ liệu đầu vào, phiên bản mô hình và snapshot dữ liệu của một dự báo để tái lập kết quả. | Must | FR-M7-03, FR-M7-04, FR-M7-09, FR-M7-10 |
| US-11 | Analyst | Là analyst, tôi muốn so sánh mô hình baseline với mô hình đa phương thức trên cùng tập test để biết cảm xúc tin có giúp ích không. | Must | FR-M6-04 |
| US-12 | Admin | Là admin, tôi muốn quản lý tài khoản và vai trò để mỗi người chỉ thấy đúng mức thông tin. | Must | FR-M7-01 |
| US-13 | Admin | Là admin, tôi muốn xem trạng thái các nguồn dữ liệu và lần chạy pipeline để phát hiện sớm dữ liệu thiếu. | Must | FR-M7-02 |
| US-14 | Admin | Là admin, tôi muốn chọn phiên bản mô hình đang phục vụ và quay lại bản trước để xử lý khi mô hình mới kém hơn. | Should | FR-M7-06 |
| US-15 | Swing trader | Là swing trader, tôi muốn lọc toàn bộ danh sách mã theo nhãn, kỳ hạn, ngưỡng xác suất và lưu bộ lọc để sàng lọc nhanh mỗi ngày. | Must (GĐ2) | FR-M8-01..06 |
| US-16 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn nhập giao dịch của mình vào Portfolio để xem lãi/lỗ tạm tính và tín hiệu hiện tại của từng mã đang nắm. | Must (GĐ2) | FR-M9-01, FR-M9-03, FR-M9-04 |
| US-17 | Swing trader | Là swing trader, tôi muốn tự lập Trade Plan (vùng vào, cắt lỗ, mục tiêu) và thấy tỷ lệ lợi nhuận/rủi ro cùng khối lượng tối đa theo mức rủi ro của mình để giữ kỷ luật; nhà đầu tư cá nhân dùng bản rút gọn. | Must (GĐ2) | FR-M10-01..07 |
| US-18 | Swing trader | Là swing trader, tôi muốn nhật ký tự ghi lại kế hoạch đã đóng kèm dự báo lúc quyết định để nhìn lại mình làm theo hay ngược tín hiệu và kết quả ra sao. | Must (GĐ2) | FR-M11-01..03 |
| US-19 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn hỏi hệ thống bằng tiếng Việt về dự báo, lý do và lịch sử của một mã và nhận câu trả lời có trích dẫn nguồn, không phải lời khuyên mua/bán. | Must (GĐ2) | FR-M12-01..03 |
| US-20 | Analyst | Là analyst, tôi muốn xuất báo cáo PDF của một mã hoặc danh mục kèm thời điểm dữ liệu và phiên bản mô hình để đính kèm vào tài liệu của mình. | Must (GĐ2) | FR-M13-01..05 |
| US-21 | Swing trader | Là swing trader, tôi muốn nhận cảnh báo qua email hoặc Telegram khi không mở ứng dụng để không bỏ lỡ thay đổi tín hiệu hoặc mốc trong kế hoạch. | Must (GĐ2) | FR-M5-06..08, FR-M10-06 |
| US-22 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn dùng ứng dụng trên điện thoại iOS/Android để xem dự báo, watchlist và cập nhật Trade Plan mọi lúc. | Must (GĐ3) | FR-M14-01..02 |
| US-23 | Mọi người dùng | Là người dùng, tôi muốn đăng nhập bằng email và mật khẩu, và đăng xuất khi dùng xong, để xem dự báo và dữ liệu cá nhân của riêng tôi | Must | FR-M0-01 đến FR-M0-04 |
| US-24 | Admin | Là admin, tôi muốn hệ thống tự động cập nhật dự báo sau mỗi phiên giao dịch, để người dùng luôn thấy tín hiệu mới trước 20:00 mà tôi không phải chạy tay |  | FR-M7-07, FR-M7-08 FR-M4-01, 06, FR-M6-02, FR-M7-04 |
| US-25 | Admin | Là admin, tôi muốn xem nhật ký hành động quản trị để biết ai đã thay đổi gì và khi nào. | Must | FR-M7-05, FR-M7-11 |
| US-26 | Nhà đầu tư cá nhân | Là nhà đầu tư cá nhân, tôi muốn tự đăng ký bằng email và mật khẩu để dùng hệ thống mà không phải chờ Admin tạo tài khoản. | Must | FR-M0-08, FR-M0-09, FR-M0-10 |
| US-27 | Swing trader, môi giới, analyst | Là người dùng, tôi muốn tự nâng cấp lên Trader và gửi yêu cầu quyền Analyst để dùng đầy đủ công cụ phù hợp với nhu cầu. | Must | FR-M0-11 |
| US-28 | Admin | Là admin, tôi muốn duyệt hoặc từ chối yêu cầu nâng quyền và tạo Admin khác một cách có kiểm soát. | Must | FR-M0-12, FR-M0-14, FR-M0-15 |
| US-29 | Mọi người dùng | Là người dùng, tôi muốn xem lại các lần đồng ý điều khoản và tự xóa tài khoản cùng dữ liệu cá nhân của mình. | Must | FR-M0-10, FR-M0-13 |

Use case mở rộng: môi giới dùng watchlist + forecast card để chuẩn bị danh sách mã trao đổi với khách (US-04, US-07); quản lý danh mục dùng cảnh báo xác suất giảm cao cho các mã đang nắm giữ (US-05) và Portfolio để đối chiếu (US-16). Các story vòng quyết định (US-15..US-22) áp dụng cho cả nhà đầu tư cá nhân (bản rút gọn) và trader/analyst (bản đầy đủ).

### 9.2. Use case

Một use case mô tả một việc cụ thể mà một người dùng (hoặc hệ thống) làm để đạt một mục tiêu. Mỗi use case dưới đây có cùng một mẫu để dễ tìm thông tin:

| Phần | Cho biết điều gì |
| --- | --- |
| Bảng thông tin | Mục tiêu, người dùng dùng, cần gì trước khi bắt đầu, kết quả cuối cùng, và mã truy vết (US, FR, NFR, AC) |
| Các bước | Đánh số lần lượt; mỗi dòng cho biết Người dùng hoặc Hệ thống làm gì; mã yêu cầu để đối chiếu với PRD nằm trong ngoặc ở cuối dòng (có thể bỏ qua khi đọc lần đầu) |
| Trường hợp đặc biệt | Các tình huống “nếu… thì…” như thiếu dữ liệu, sai quyền, nhập sai |

**Chú thích**

**Vai trò:** Retail = nhà đầu tư cá nhân; Trader = swing trader; Analyst = chuyên viên phân tích; Admin = quản trị viên; Khách = người chưa có tài khoản; Hệ thống = tác vụ tự động.

**Mã truy vết:** US = user story (mục 9 của PRD); FR = yêu cầu chức năng (mục 10); NFR = yêu cầu phi chức năng (mục 11); AC = tiêu chí nghiệm thu (mục 13).

**Giai đoạn:** GĐ1 là phần cốt lõi sẽ bảo vệ; GĐ2 và GĐ3 là phần mở rộng, nên coi là hướng phát triển (xem phần 3).

Use case UC-01 đến UC-29 khớp theo thứ tự với user story US-01 đến US-29.

Tên nhãn và kỳ hạn giữ nguyên như PRD: Tăng / Đi ngang / Giảm; T+2 và T+5.

**Quy tắc áp dụng cho mọi use case** (không nhắc lại ở từng use case)

Người dùng phải đăng nhập (UC-23), trừ UC-26 (đăng ký, xác thực email); quyền và quyền sở hữu dữ liệu được kiểm tra ở phía máy chủ, không chỉ ẩn nút trên giao diện.

Mọi màn hình có dự báo hiển thị tuyên bố “Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư”; không dùng chữ “MUA”, “BÁN” ở nhãn tín hiệu, gợi ý và câu trả lời Chat.

Hành động quan trọng được ghi nhật ký (log) nhưng không ghi mật khẩu hay token.

**Ai dùng hệ thống để làm gì**

| UC | Việc cần làm | Người dùng | Story | Giai đoạn |
| --- | --- | --- | --- | --- |
| UC-01 | Xem tín hiệu của các mã trên trang tổng quan | Retail, Trader, Analyst | US-01 | GĐ1 |
| UC-02 | Xem thẻ dự báo và lý do dự báo của một mã | Retail, Trader, Analyst | US-02 | GĐ1 |
| UC-03 | Xem tin mới và sắc thái tin của một mã | Retail, Trader, Analyst | US-03 | GĐ1 |
| UC-04 | Thêm mã vào danh sách theo dõi (watchlist) | Retail, Trader, Analyst | US-04 | GĐ1 |
| UC-05 | Đặt ngưỡng và nhận cảnh báo trong ứng dụng | Trader | US-05 | GĐ1 |
| UC-06 | So sánh dự báo T+2 với T+5 | Trader | US-06 | GĐ1 |
| UC-07 | Lọc, sắp xếp, tìm kiếm danh sách mã | Trader | US-07 | GĐ1 |
| UC-08 | Xem lịch sử dự báo và hit rate của một mã | Trader | US-08 | GĐ1 |
| UC-09 | Xem đóng góp của từng đặc trưng vào dự báo | Analyst | US-09 | GĐ1 |
| UC-10 | Xem dữ liệu đầu vào và tái lập một dự báo | Analyst | US-10 | GĐ1 |
| UC-11 | So sánh mô hình baseline với mô hình đa phương thức | Analyst, Admin | US-11 | GĐ1 |
| UC-12 | Quản lý tài khoản và vai trò | Admin | US-12 | GĐ1 |
| UC-13 | Xem trạng thái nguồn dữ liệu và chạy lại job | Admin | US-13 | GĐ1 |
| UC-14 | Chọn phiên bản mô hình và quay lại bản trước | Admin | US-14 | GĐ1 |
| UC-23 | Đăng nhập, đăng xuất | Mọi người dùng | US-23 | GĐ1 |
| UC-24 | Chạy dự báo tự động sau mỗi phiên | Hệ thống | US-24 | GĐ1–GĐ2 |
| UC-15 | Sàng lọc cổ phiếu bằng Screener | Retail, Trader, Analyst | US-15 | GĐ2 |
| UC-16 | Ghi giao dịch và xem danh mục (Portfolio) | Retail, Trader, Analyst | US-16 | GĐ2 |
| UC-17 | Lập và theo dõi kế hoạch giao dịch (Trade Plan) | Retail, Trader, Analyst | US-17 | GĐ2 |
| UC-18 | Xem và ghi nhật ký giao dịch (Journal) | Retail, Trader, Analyst | US-18 | GĐ2 |
| UC-19 | Hỏi đáp bằng Chat | Retail, Trader, Analyst | US-19 | GĐ2 |
| UC-20 | Xuất báo cáo PDF | Retail, Trader, Analyst | US-20 | GĐ2 |
| UC-21 | Nhận thông báo qua email và Telegram | Retail, Trader, Analyst | US-21 | GĐ2 |
| UC-22 | Dùng ứng dụng trên điện thoại | Retail, Trader, Analyst | US-22 | GĐ3 |
| UC-25 | Xem nhật ký hành động quản trị | Admin | US-25 | GD1 |
| UC-26 | Tự đăng ký và xác thực email | Khách (chưa có tài khoản) | US-26 | GĐ1 |
| UC-27 | Nâng cấp Trader, yêu cầu quyền Analyst | Retail, Trader | US-27 | GĐ1 |
| UC-28 | Duyệt hoặc từ chối yêu cầu nâng quyền | Admin | US-28 | GĐ1 |
| UC-29 | Tạo Admin, xem đồng ý và xóa tài khoản | Admin, Retail, Trader, Analyst | US-28, US-29 | GĐ1 |

#### 9.2.1. Xem và hiểu dự báo (UC-01 đến UC-06)

**UC-01. Xem tín hiệu các mã (trang tổng quan)**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Nhìn nhanh tín hiệu T+2 và T+5 của các mã để chọn ra vài mã đáng chú ý |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; dự báo của phiên gần nhất đã được tạo (UC-24) |
| Kết quả | Thấy đủ các mã trong phạm vi; mỗi mã có tín hiệu T+2, T+5 và ngày dữ liệu đúng |
| Truy vết | US-01 · FR-M1-01, 03, 05, 06, 07 · NFR-01, 04, 10, 13 · AC-01 |

**Các bước**

**Người dùng** mở trang chủ.

**Hệ thống** kiểm tra phiên đăng nhập và vai trò (NFR-07, NFR-08), rồi hiển thị bảng các mã gồm mã, tên công ty, sàn, ngành, giá đóng cửa, % thay đổi và giá trị giao dịch bình quân 20 phiên (FR-M1-01).

**Hệ thống** hiển thị tín hiệu T+2 và T+5 của từng mã: nhãn có màu và biểu tượng cùng xác suất của nhãn dự báo (FR-M1-03, NFR-10).

**Hệ thống** hiển thị ngày dữ liệu và thời điểm cập nhật dự báo ở đầu trang (FR-M1-05, AC-01).

**Hệ thống** hiển thị thêm dải VN-Index, HNX-Index, độ rộng thị trường và khối “Tín hiệu đổi hôm nay” (FR-M1-06, FR-M1-07).

**Hệ thống** tải xong trang trong dưới 3 giây (NFR-01, AC-01).

**Người dùng** lọc, sắp xếp (UC-07) hoặc chọn một mã để xem chi tiết (UC-02).

**Trường hợp đặc biệt**

Giá phiên T chưa có hoặc dự báo chưa chạy xong → hiển thị dự báo gần nhất kèm nhãn “dữ liệu cũ” (NFR-04, AC-06).

Một mã thiếu tin → vẫn có tín hiệu (tính từ giá và tài chính) và gắn cờ “thiếu dữ liệu tin” (NFR-04, AC-05).

Phiên đăng nhập hết hạn → chuyển về trang đăng nhập (UC-23).

**UC-02. Xem thẻ dự báo và lý do dự báo**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Hiểu hệ thống dự báo gì cho một mã, chắc chắn đến đâu và vì sao |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; mã nằm trong phạm vi |
| Kết quả | Thấy nhãn, xác suất 3 lớp, ngày đáo hạn, lý do theo đúng mức vai trò và cảnh báo tham khảo |
| Truy vết | US-02 · FR-M3-01, 03, 04; FR-M2-01..04, 06, 07; FR-M2-08, 09 · NFR-01, 04, 05, 10, 13 · AC-03, 04, 05 |

**Các bước**

**Người dùng** chọn một mã từ trang tổng quan, watchlist hoặc cảnh báo.

**Hệ thống** tải dự báo mới nhất và lịch sử giá của mã.

**Hệ thống** hiển thị nhãn Tăng / Đi ngang / Giảm cho kỳ hạn đang chọn (FR-M2-01) và xác suất của cả 3 lớp dạng thanh ngang, tổng 100% với sai số ±0,1 (FR-M2-02, AC-03).

**Hệ thống** hiển thị thời điểm tạo dự báo, ngày dữ liệu cơ sở và ngày đáo hạn tính theo lịch giao dịch (FR-M2-03), cùng cảnh báo tham khảo cố định (FR-M2-04, NFR-13).

**Hệ thống** hiển thị biểu đồ giá 6 tháng kèm khối lượng, đánh dấu các ngày có tin mạnh (FR-M2-06), và trạng thái dữ liệu (đầy đủ / thiếu tin / thiếu BCTC / dữ liệu cũ) cùng độ tin cậy (FR-M2-07).

**Hệ thống** hiển thị khối “Vì sao?”: tỷ trọng đóng góp của 3 nhóm (tài chính, kỹ thuật, tin tức) và ít nhất 3 yếu tố ảnh hưởng nhất, kèm chiều đẩy lên hoặc kéo xuống (FR-M3-01).

**Hệ thống** hiển thị lý do theo vai trò: Retail xem 3 câu tiếng Việt dễ hiểu, không dùng thuật ngữ như SHAP, RSI khi không có chú thích (FR-M3-03, AC-04); Trader xem thêm hit rate (NFR-05); Analyst xem thêm ở UC-09.

**Người dùng** chuyển giữa T+2 và T+5.

**Hệ thống** cập nhật thẻ dự báo và lý do theo kỳ hạn mới (FR-M2-01, FR-M2-02); trang hiển thị trong dưới 3 giây (NFR-01, AC-03).

**Hệ thống** hiển thị mức tin cậy 3 bậc và khối “Điều gì có thể làm dự báo sai” (FR-M2-08, FR-M2-09).

**Trường hợp đặc biệt**

Thiếu một nhóm dữ liệu → bỏ phần giải thích nhóm đó và ghi rõ lý do, ví dụ “Không có dữ liệu tin tức trong 5 phiên gần nhất” (FR-M3-04, AC-05).

Giá ngày T bị lỗi → hiển thị dự báo hôm trước kèm nhãn “dữ liệu cũ” (NFR-04, AC-06).

Xác suất cao nhất dưới 45% → gắn nhãn “độ tin cậy thấp”  (FR-M2-08).

Chưa có dự báo cho mã → hiển thị “Chưa có dự báo”.

**UC-03. Xem tin mới và sắc thái tin**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Xem các tin mới nhất về mã kèm sắc thái, không phải tự đọc từng bài |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đang ở trang chi tiết mã (UC-02); tin đã được thu thập, loại trùng và chấm sắc thái (UC-24) |
| Kết quả | Tin sắp xếp mới nhất trước, không trùng, có nhãn sắc thái, link mở đúng bài gốc |
| Truy vết | US-03 · FR-M4-01, 02, 03; FR-M4-04, 05 · NFR-01, 10 · AC-07 |

**Các bước**

**Người dùng** mở tab Tin tức của mã.

**Hệ thống** tải các tin liên quan đến mã, đã loại trùng (FR-M4-01).

**Hệ thống** hiển thị danh sách mới nhất trước: tiêu đề, nguồn, thời gian, tóm tắt, nhãn sắc thái (tích cực / trung tính / tiêu cực) có màu kèm độ tin cậy (FR-M4-02, FR-M4-03, AC-07), và biểu đồ chỉ số cảm xúc theo ngày của 30 phiên cạnh biểu đồ giá (FR-M4-04). Với Trader và Analyst, hiển thị thêm mức ảnh hưởng tương đối của từng tin tới dự báo nếu mô hình cung cấp (FR-M4-05, Should).

**Người dùng** lọc theo sắc thái và khoảng ngày.

**Hệ thống** cập nhật danh sách (FR-M4-03).

**Người dùng** chọn một tin.

**Hệ thống** mở bài gốc ở tab mới (FR-M4-03, AC-07).

**Trường hợp đặc biệt**

Không có tin trong 30 ngày → hiển thị “Không có tin”; khối giải thích bỏ nhóm tin tức (FR-M3-04).

Link gốc không mở được → thông báo lỗi liên kết.

**UC-04. Thêm mã vào watchlist**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Lưu các mã quan tâm để lần sau mở lại nhanh |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập |
| Kết quả | Mã còn trong watchlist sau khi đăng xuất và đăng nhập lại |
| Truy vết | US-04 · FR-M5-01 · NFR-08 · AC-09 |

**Các bước**

**Người dùng** chọn “Thêm vào watchlist” ở trang tổng quan hoặc trang chi tiết.

**Hệ thống** kiểm tra mã chưa có trong watchlist của người dùng và số mã chưa vượt 10 mã mỗi người (FR-M5-01, AC-09).

**Hệ thống** lưu mã gắn với tài khoản và đổi nút thành “Đã theo dõi” (FR-M5-01).

**Người dùng** mở trang Watchlist.

**Hệ thống** hiển thị các mã đang theo dõi cùng tín hiệu T+2, T+5 mới nhất và dấu “đổi nhãn” (US-04, FR-M5-02).

**Người dùng** chọn “Xóa” trên một mã.

**Hệ thống** gỡ mã khỏi watchlist (FR-M5-01).

**Trường hợp đặc biệt**

Mã đã có trong watchlist → không tạo bản sao.

Đã đủ 10 mã → từ chối thêm và hiển thị thông báo giới hạn (AC-09).

**UC-05. Đặt ngưỡng và nhận cảnh báo trong ứng dụng**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Được báo khi tín hiệu đổi (ví dụ Đi ngang → Tăng) hoặc xác suất vượt ngưỡng đã đặt |
| Người dùng | Trader |
| Điều kiện trước | Mã nằm trong watchlist của người dùng (UC-04) |
| Kết quả | Cảnh báo hiện trong ứng dụng trong 5 phút sau khi dự báo xong và được lưu 90 ngày |
| Truy vết | US-05 · FR-M5-02, 03, 04, 05 (Should) · NFR-03, 04 · AC-10, 11 |

**Các bước**

**Người dùng** chọn mã và kỳ hạn, rồi nhập ngưỡng xác suất, ví dụ P(tăng) ≥ 60%.

**Hệ thống** lưu quy tắc gắn với người dùng, mã và kỳ hạn (FR-M5-03).

**Hệ thống** (tự động sau mỗi lần dự báo) so nhãn hôm nay với phiên trước; nếu đổi thì đánh dấu mã và tạo cảnh báo “Đi ngang → Tăng” (FR-M5-02, AC-10).

**Hệ thống** đối chiếu xác suất với ngưỡng: chỉ tạo cảnh báo khi xác suất vừa vượt từ dưới lên, không tạo lại nếu hôm sau vẫn ở trên ngưỡng, và chạy lại batch không tạo cảnh báo trùng (FR-M5-03, AC-11).

**Hệ thống** hiển thị cảnh báo qua biểu tượng chuông và danh sách thông báo trong vòng 5 phút sau khi dự báo xong, đồng thời lưu vào lịch sử 90 ngày gồm thời gian, mã, nội dung, đã đọc hoặc chưa (FR-M5-05, FR-M5-04, AC-10).

**Người dùng** mở một cảnh báo.

**Hệ thống** đánh dấu đã đọc và chuyển tới trang chi tiết mã (UC-02) (FR-M5-04).

**Trường hợp đặc biệt**

Ngưỡng ngoài khoảng 0–100% → từ chối và yêu cầu nhập lại.

Dự báo hôm đó thất bại → không tạo cảnh báo mới, giữ dự báo cũ kèm nhãn “dữ liệu cũ” (NFR-03, NFR-04).

Muốn nhận qua email hoặc Telegram → xem UC-21.

**UC-06. So sánh T+2 với T+5**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết tín hiệu ngắn hạn và dài hơn đồng thuận hay mâu thuẫn |
| Người dùng | Trader |
| Điều kiện trước | Đang ở trang chi tiết mã (UC-02); mã có dự báo cho cả hai kỳ hạn |
| Kết quả | Thấy hai thẻ cạnh nhau và dấu nổi bật nếu hai nhãn mâu thuẫn |
| Truy vết | US-06 · FR-M2-01..05, 08 · NFR-10 · AC-03 |

**Các bước**

**Người dùng** mở trang chi tiết mã.

**Hệ thống** hiển thị hai thẻ dự báo T+2 và T+5 cạnh nhau (FR-M2-05); mỗi thẻ có nhãn, xác suất 3 lớp, ngày đáo hạn và cảnh báo tham khảo (FR-M2-01..04).

**Hệ thống** đối chiếu hai nhãn; nếu mâu thuẫn thì đánh dấu nổi bật và hạ mức tin cậy một bậc (FR-M2-05, FR-M2-08).

**Trường hợp đặc biệt**

Thiếu dự báo của một kỳ hạn → hiển thị trạng thái dữ liệu của kỳ hạn đó, không đánh dấu mâu thuẫn.

#### 9.2.2. Sàng lọc, theo dõi và phân tích (UC-07 đến UC-11)

**UC-07. Lọc, sắp xếp, tìm kiếm danh sách mã**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Thu hẹp danh sách mã theo sàn, ngành, thanh khoản, xu hướng dự báo |
| Người dùng | Trader |
| Điều kiện trước | Đang ở trang chủ (UC-01) |
| Kết quả | Danh sách chỉ còn các mã thỏa mọi điều kiện đã chọn |
| Truy vết | US-07 · FR-M1-02, 04 · NFR-01 · AC-02 |

**Các bước**

**Người dùng** chọn một hoặc nhiều điều kiện lọc: sàn (HOSE, HNX, UPCoM), ngành, thanh khoản, xu hướng dự báo (Tăng, Đi ngang, Giảm), kỳ hạn.

**Hệ thống** áp dụng đồng thời các điều kiện và hiển thị các mã thỏa mọi điều kiện (FR-M1-02, AC-02).

**Người dùng** chọn tiêu chí sắp xếp: xác suất tăng, xác suất giảm, thanh khoản hoặc % thay đổi.

**Hệ thống** sắp xếp lại danh sách (FR-M1-04).

**Người dùng** nhập mã hoặc tên công ty vào ô tìm kiếm.

**Hệ thống** lọc danh sách theo từ khóa (FR-M1-04).

**Người dùng** chọn “Xóa bộ lọc”.

**Hệ thống** trả lại danh sách đầy đủ (AC-02).

**Trường hợp đặc biệt**

Không có mã nào thỏa điều kiện → hiển thị “Không có mã phù hợp” kèm nút xóa bộ lọc.

Ví dụ nghiệm thu: chọn sàn HNX và T+2 = Tăng thì chỉ còn các mã HNX có nhãn T+2 = Tăng (AC-02).

**UC-08. Xem lịch sử dự báo và hit rate của một mã**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết tín hiệu của mã này trước đây đúng bao nhiêu để quyết định có nên tin hay không |
| Người dùng | Trader |
| Điều kiện trước | Đang ở trang chi tiết mã; mã đã có dự báo cũ |
| Kết quả | Hit rate khớp với tính tay trên 20 dòng mẫu; có số mẫu, cảnh báo “mẫu nhỏ” và baseline |
| Truy vết | US-08 · FR-M6-01, 02, 03, 06; FR-M6-05 · NFR-08 · AC-12 |

**Các bước**

**Người dùng** mở tab Lịch sử của mã.

**Hệ thống** tải các dự báo cũ và hiển thị bảng: ngày, kỳ hạn, nhãn dự báo, xác suất, nhãn thực tế, đúng hoặc sai (FR-M6-01).

**Hệ thống** ghi “Đang chờ” cho dự báo chưa đủ 2 hoặc 5 phiên; với dự báo đã đủ kỳ hạn thì nhãn thực tế đã được điền tự động (UC-24) (FR-M6-02, AC-12).

**Hệ thống** tính hit rate, precision, recall theo từng lớp cho mã và cho toàn bộ, trong cửa sổ 30 hoặc 90 phiên (FR-M6-03).

**Hệ thống** hiển thị cạnh mỗi hit rate: số mẫu n, cảnh báo “mẫu nhỏ” khi n < 50, baseline “lớp phổ biến nhất” trong cùng cửa sổ, và ghi chú dự báo T+5 chồng lấn nên số mẫu độc lập ít hơn n (FR-M6-06, AC-12).

**Người dùng** chọn cửa sổ 30 hoặc 90 phiên.

**Hệ thống** tính lại và hiển thị (FR-M6-03).

**Người dùng** chọn “Xuất CSV”.

**Hệ thống** tạo file lịch sử dự báo để tải về (FR-M6-05).

**Trường hợp đặc biệt**

Mã chưa có dự báo đủ kỳ hạn → chỉ hiển thị các dòng “Đang chờ”, chưa tính hit rate.

Retail hoặc Trader gọi xuất CSV → bị từ chối (403) (FR-M6-05, NFR-08).

**UC-09. Xem đóng góp từng đặc trưng**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Đánh giá một dự báo có đáng tin hay không bằng cách xem từng đặc trưng đóng góp bao nhiêu |
| Người dùng | Analyst |
| Điều kiện trước | Đang ở trang chi tiết mã; dự báo có dữ liệu giải thích |
| Kết quả | Thấy top 15 đặc trưng với đóng góp và giá trị thô, khác với nội dung Retail thấy |
| Truy vết | US-09 · FR-M3-02, 04 · NFR-05, 08 · AC-04, 15 |

**Các bước**

**Người dùng** (Analyst) mở tab Analyst.

**Hệ thống** kiểm tra vai trò Analyst ở phía máy chủ (NFR-08).

**Hệ thống** hiển thị đóng góp chi tiết của top 15 đặc trưng cùng giá trị thô của từng đặc trưng (FR-M3-02, AC-04), và trọng số attention trên các tin (FR-M3-02).

**Hệ thống** không hiển thị giải thích cho nhóm dữ liệu bị thiếu và ghi rõ trạng thái (FR-M3-04, NFR-05).

**Người dùng** đối chiếu với giải thích đơn giản của Retail (UC-02) cho cùng mã để đánh giá độ tin cậy (AC-04).

**Trường hợp đặc biệt**

Retail hoặc Trader mở API này → không thấy tab, API trả 403 (NFR-08, AC-15).

Dự báo chưa có dữ liệu giải thích → hiển thị trạng thái thay thế, không hiển thị giải thích giả (NFR-05).

**UC-10. Xem dữ liệu đầu vào và tái lập một dự báo**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Kiểm tra một dự báo được tạo từ dữ liệu và phiên bản mô hình nào, và chạy lại được cùng kết quả |
| Người dùng | Analyst |
| Điều kiện trước | Dự báo đã được lưu cùng bản ghi audit (UC-24) |
| Kết quả | Truy vết được dự báo tới phiên bản mô hình và snapshot dữ liệu; tái lập đạt trên 10 dự báo ngẫu nhiên |
| Truy vết | US-10 · FR-M7-03, 04, 09, 10 · NFR-06, 08 · AC-14 |

**Các bước**

**Người dùng** (Analyst) mở tab Audit và chọn một dự báo.

**Hệ thống** kiểm tra vai trò Analyst hoặc Admin (NFR-08).

**Hệ thống** hiển thị bản ghi audit: thời điểm, phiên bản mô hình, mã snapshot dữ liệu, trạng thái, người hoặc job kích hoạt (FR-M7-04, AC-14).

**Hệ thống** hiển thị dữ liệu đầu vào của dự báo (giá, báo cáo tài chính, tin, snapshot) (US-10) cùng phiên bản mô hình, ngày huấn luyện, khoảng dữ liệu và metrics (FR-M7-03).

**Người dùng** chọn “Chạy lại”.

**Hệ thống** chạy lại với đúng phiên bản mô hình và snapshot đã lưu, rồi so với xác suất đã lưu (NFR-06, AC-14).

**Hệ thống** hiển thị kết quả: đạt khi sai số nhỏ hơn 1e-4 (NFR-06, AC-14).

**Trường hợp đặc biệt**

Snapshot hoặc phiên bản mô hình không còn → thông báo “không tái lập được” và ghi log.

Retail hoặc Trader mở API này → bị từ chối (403) (NFR-08).

**UC-11. So sánh mô hình baseline với mô hình đa phương thức**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết cảm xúc tin tức có giúp dự báo tốt hơn hay không |
| Người dùng | Analyst, Admin; |
| Điều kiện trước | Có ít nhất 1 baseline và 1 mô hình đa phương thức đã được đánh giá trên tập test |
| Kết quả | Thấy đủ chỉ số, confusion matrix cho T+2 và T+5, và bảng ablation |
| Truy vết | US-11 · FR-M6-04; FR-M6-07 · NFR-08, 12 · AC-13 |

**Các bước**

**Người dùng** mở trang Đánh giá mô hình.

**Hệ thống** kiểm tra vai trò Analyst hoặc Admin ở phía máy chủ (FR-M6-04, NFR-08).

**Hệ thống** hiển thị cho T+2 và T+5: Accuracy, Macro F1, Precision, Recall, AUC-ROC và confusion matrix (FR-M6-04, AC-13).

**Hệ thống** hiển thị bảng so sánh baseline với mô hình đa phương thức trên cùng tập test, và bảng ablation 3 cấu hình: chỉ định lượng, chỉ văn bản và cảm xúc, kết hợp (AC-13).

**Hệ thống** hiển thị biểu đồ hiệu chỉnh xác suất (reliability diagram), Brier score và ECE (FR-M6-07).

**Hệ thống** hiển thị phiên bản mô hình, khoảng dữ liệu huấn luyện, ngày huấn luyện và cấu hình thí nghiệm (NFR-12).

**Người dùng** đọc kết quả để trả lời câu hỏi: cảm xúc tin tức có giúp ích không.

**Trường hợp đặc biệt**

Retail hoặc Trader gọi API chi tiết → bị từ chối (403) (NFR-08). Theo SDD, hai vai trò này xem được một bản tóm tắt (hit rate tổng kèm số mẫu và baseline).

Chưa có kết quả đánh giá → hiển thị thông báo.

#### 9.2.3. Quản trị và vận hành (UC-12, UC-13, UC-14, UC-23, UC-24, UC-25)

**UC-12. Quản lý tài khoản và vai trò**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tạo, khóa tài khoản và gán vai trò để mỗi người chỉ thấy đúng mức thông tin |
| Người dùng | Admin |
| Điều kiện trước | Admin đã đăng nhập (UC-23) |
| Kết quả | Tài khoản và vai trò được cập nhật, có ghi nhật ký; Admin không xem được nội dung Portfolio, Trade Plan, Journal của người dùng |
| Truy vết | US-12 · FR-M7-01, 05, 11 · FR-M0-14 · NFR-07, 08, 09, AC-15, AC-29 · UC-25, UC-28, UC-29 |

**Các bước**

**Người dùng** (Admin) mở khu vực Quản trị, mục Người dùng, và chọn “Tạo người dùng”.

**Hệ thống** hiển thị biểu mẫu tạo tài khoản (FR-M7-01).

**Người dùng** nhập email và chọn vai trò (Retail, Trader, Analyst, Admin). Đây là kênh tạo tài khoản bổ sung cho kênh tự đăng ký (UC-26), và là kênh duy nhất để tạo thêm Admin (UC-29).

**Hệ thống** kiểm tra email hợp lệ và chưa tồn tại, sinh mật khẩu tạm hiển thị một lần, băm mật khẩu (NFR-07) rồi lưu tài khoản ở trạng thái buộc đổi mật khẩu lần đầu, ghi log mà không ghi mật khẩu (FR-M7-01, FR-M0-07, NFR-09).

**Người dùng** chọn một tài khoản rồi chọn “Khóa” hoặc vai trò mới.

**Hệ thống** áp dụng thay đổi mọi phiên đang mở của tài khoản bị thu hồi và ghi nhật ký hành động quản trị: ai làm, với tài khoản nào, thay đổi gì, khi nào (FR-M7-01, FR-M7-05).

**Hệ thống** áp dụng quyền theo vai trò mới từ các lời gọi API tiếp theo (NFR-08).

**Trường hợp đặc biệt**

Email đã tồn tại → từ chối và thông báo.

Người không phải Admin mở khu vực này → không thấy menu Quản trị, API trả 403 (NFR-08, AC-15).

Admin tự khóa hoặc tự hạ quyền chính mình → chặn nếu đó là Admin cuối cùng.

**UC-13. Xem trạng thái nguồn dữ liệu và chạy lại job**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Phát hiện sớm dữ liệu thiếu hoặc lỗi và chạy lại khi cần |
| Người dùng | Admin |
| Điều kiện trước | Admin đã đăng nhập |
| Kết quả | Admin biết nguồn nào thiếu hoặc lỗi và chạy lại được |
| Truy vết | US-13 · FR-M7-02, 05 · NFR-03, 09 · AC-06 |

**Các bước**

**Người dùng** (Admin) mở khu vực Quản trị, mục Nguồn dữ liệu.

**Hệ thống** hiển thị các nguồn (SSI iBoard hoặc vnstock, CafeF, báo cáo tài chính); với mỗi nguồn có lần chạy gần nhất, trạng thái, số bản ghi và lỗi nếu có (FR-M7-02).

**Người dùng** chọn một nguồn hoặc job lỗi để xem chi tiết.

**Hệ thống** hiển thị lỗi kèm mã job (NFR-03).

**Người dùng** chọn “Chạy lại thủ công”.

**Hệ thống** tạo lần chạy mới (không chạy trùng khi job đang chạy) và ghi log kèm mã job (FR-M7-02, NFR-03, NFR-09).

**Hệ thống** cập nhật trạng thái, số bản ghi và lỗi sau khi job kết thúc (FR-M7-02).

**Trường hợp đặc biệt**

Job tự động thất bại sau 3 lần thử lại → trạng thái nguồn chuyển sang lỗi và Admin thấy lỗi ở trang này (NFR-03, AC-06).

Chất lượng mô hình giảm (Macro F1 30 phiên giảm hơn 10 điểm) → tạo cảnh báo cho Admin (RK-04).

Nguồn đổi cấu trúc dữ liệu → đánh dấu lỗi, giữ dữ liệu thô để chạy lại (RK-09).

**UC-14. Chọn phiên bản mô hình và quay lại bản trước**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Đổi sang phiên bản mô hình khác, hoặc quay lại bản cũ khi bản mới kém hơn |
| Người dùng | Admin |
| Điều kiện trước | Có ít nhất hai phiên bản mô hình đã đăng ký |
| Kết quả | Phiên bản đang phục vụ được đổi; mọi dự báo mới ghi đúng phiên bản vào audit |
| Truy vết | US-14 · FR-M7-06 (Should), FR-M7-03 (Must), FR-M7-05 · NFR-08 · AC-16 |

**Các bước**

**Người dùng** (Admin) mở khu vực Quản trị, mục Mô hình.

**Hệ thống** hiển thị danh sách phiên bản: mã, ngày huấn luyện, khoảng dữ liệu, metrics và bản đang phục vụ (FR-M7-03).

**Người dùng** chọn một phiên bản (mới hoặc cũ) để phục vụ.

**Hệ thống** yêu cầu xác nhận (FR-M7-06) và kiểm tra phiên bản đã qua cổng đánh giá; bản chưa qua cổng không được dùng (SDD §7.7).

**Người dùng** xác nhận.

**Hệ thống** đặt phiên bản đó làm bản đang phục vụ (FR-M7-06) và ghi nhật ký: người thực hiện, phiên bản cũ, phiên bản mới, thời gian (FR-M7-05, AC-16).

**Hệ thống** dùng phiên bản vừa chọn cho lần chạy dự báo kế tiếp (UC-24) (AC-16).

**Trường hợp đặc biệt**

Chọn lại bản cũ khi bản mới kém hơn → đây là “rollback”, các bước như trên (FR-M7-06, AC-16).

Analyst mở danh sách → chỉ xem, không có thao tác chọn (FR-M7-03).

Bản chưa qua cổng đánh giá hoặc thiếu file trọng số → từ chối, giữ nguyên bản hiện tại.

**UC-23. Đăng nhập, đăng xuất**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Vào hệ thống và chỉ được dùng đúng chức năng của vai trò mình |
| Người dùng | Mọi người dùng |
| Điều kiện trước | Tài khoản đã có (tự đăng ký và đã xác thực email — UC-26, hoặc do Admin tạo — UC-12) và đang hoạt động |
| Kết quả | Người dùng có phiên hợp lệ với đúng vai trò; hành động đăng nhập được ghi log |
| Truy vết | PRD §6.1 · FR-M7-01, FR-M14-04 · NFR-07, 08, 09, 10 · AC-15, AC-27, AC-33 · FR-M0-01, 02, 03, 04, 09 |

**Các bước****:**

**Người dùng** mở ứng dụng.

**Hệ thống** hiển thị trang đăng nhập bằng tiếng Việt (NFR-10).

**Người dùng** nhập email và mật khẩu, chọn “Đăng nhập”.

**Hệ thống** kiểm tra định dạng, so khớp mật khẩu với bản băm (NFR-07), kiểm tra tài khoản không bị khóa (FR-M7-01) và email đã được xác thực (FR-M0-09).

**Hệ thống** cấp phiên đăng nhập hiệu lực 24 giờ, chứa vai trò (web dùng cookie an toàn; mobile lưu token ở Keychain hoặc Keystore) (NFR-07, FR-M14-04), và ghi log đăng nhập mà không ghi mật khẩu hay token (NFR-09).

**Hệ thống** chuyển tới trang tổng quan (UC-01) và hiển thị menu theo vai trò; chỉ Admin thấy menu Quản trị (NFR-08, AC-15).

**Người dùng** chọn “Đăng xuất”.

**Hệ thống** hủy phiên; trên mobile xóa token cục bộ (FR-M14-04).

**Trường hợp đặc biệt**

Sai email hoặc mật khẩu → thông báo chung, không nêu trường nào sai.

Tài khoản bị khóa → từ chối và thông báo (FR-M7-01).

Tài khoản tự đăng ký chưa xác thực email → từ chối với thông báo "Vui lòng xác thực email trước khi đăng nhập", kèm cách gửi lại thư (FR-M0-09, AC-33).

Phiên hết hạn sau 24 giờ → quay về trang đăng nhập (NFR-07).

Gọi API ngoài quyền (ví dụ Retail gọi API quản trị) → trả 403 (NFR-08, AC-15).

Phiên bị thu hồi (khóa, đổi vai trò, đổi mật khẩu) → request kế tiếp nhận 401, quay về đăng nhập; trên mobile xóa token cục bộ (FR-M14-04)

**UC-24. Chạy dự báo tự động sau mỗi phiên giao dịch**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Mỗi ngày giao dịch, tạo dự báo mới cho mọi mã kèm giải thích, cập nhật nhãn thực tế và gửi cảnh báo |
| Người dùng | Hệ thống (bộ lập lịch); Admin nhận cảnh báo lỗi |
| Điều kiện trước | Hôm nay là ngày giao dịch; đã có phiên bản mô hình đang phục vụ (UC-14) |
| Kết quả | Có dự báo mới cho toàn bộ mã trước 20:00, hoặc dự báo cũ được gắn nhãn “dữ liệu cũ” |
| Truy vết | FR-M4-01, 02, 04, 06; FR-M6-02; FR-M7-04; FR-M5-02, 03, 06, 08; FR-M9-03, 04; FR-M10-05, 06 · NFR-02, 03, 04, 06, 09, 15 · AC-05, 06, 08, 10, 11, 24 |

**Các bước** (bắt đầu lúc 15:30; mỗi bước ghi vào nhật ký job kèm mã job [NFR-03, NFR-09])

**Hệ thống – giá:** nạp giá và chỉ số của phiên T, kiểm tra đủ mã; thử lại tối đa 3 lần khi lỗi (NFR-03).

**Hệ thống – tin:** nạp tin mới theo mã và loại trùng; tin đăng sau 15:00 hoặc vào ngày nghỉ được tính cho phiên giao dịch kế tiếp (FR-M4-01, FR-M4-06, AC-08).

**Hệ thống – báo cáo tài chính:** kiểm tra báo cáo mới công bố; chỉ dùng sau ngày công bố (PRD §12.2).

**Hệ thống – sắc thái:** chấm sắc thái cho tin mới và tính chỉ số cảm xúc theo ngày (FR-M4-02, FR-M4-04).

**Hệ thống – đặc trưng:** tạo đặc trưng, snapshot dữ liệu và mã băm snapshot (NFR-06).

**Hệ thống – nhãn thực tế:** điền nhãn thực tế cho các dự báo đã đủ 2 hoặc 5 phiên (FR-M6-02).

**Hệ thống – dự báo:** sinh dự báo T+2 và T+5 cho mọi mã kèm giải thích, mức tin cậy; lưu thời điểm, phiên bản mô hình, snapshot, trạng thái, job kích hoạt (FR-M7-04, FR-M3-01..03, FR-M2-08, FR-M2-09).

**Hệ thống – cảnh báo:** kiểm tra đổi nhãn và ngưỡng xác suất; không tạo cảnh báo trùng khi chạy lại (FR-M5-02, FR-M5-03, AC-10, AC-11).

**Hệ thống – Trade Plan:** kiểm tra các kế hoạch đang theo dõi với giá đóng cửa và nhãn mới; ghi gợi ý và tạo cảnh báo (FR-M10-05, FR-M10-06).

**Hệ thống – Portfolio:** tính lại vị thế theo giá đóng cửa mới (FR-M9-03, FR-M9-04).

**Hệ thống – thông báo:** tạo thông báo email và Telegram cho cảnh báo mới; dịch vụ gửi chạy riêng (FR-M5-06, FR-M5-08, NFR-15).

**Hệ thống – giám sát:** nếu Macro F1 30 phiên giảm hơn 10 điểm so với lúc đăng ký mô hình thì cảnh báo Admin (RK-04).

**Trường hợp đặc biệt**

Giá phiên T thiếu sau 3 lần thử → dừng các bước phụ thuộc, không sinh dự báo mới, giữ dự báo hôm trước kèm “dữ liệu cũ”, Admin thấy lỗi ở UC-13 (NFR-04, AC-06).

Lỗi ở bước tin hoặc sắc thái → vẫn dự báo bằng giá và tài chính, gắn cờ “thiếu dữ liệu tin”, không giải thích cho nhóm tin tức [NFR-04, FR-M3-04, AC-05].

Thiếu báo cáo tài chính → gắn trạng thái “thiếu BCTC”, không giải thích cho nhóm tài chính (FR-M2-07, FR-M3-04).

Lỗi ở các bước 9, 10, 11 → không chặn nhau và không ảnh hưởng dự báo đã ghi.

**UC-25. Xem nhật ký hành động quản trị**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Biết ai đã thay đổi gì, với đối tượng nào và khi nào |
| Người dùng | Admin |
| Điều kiện trước | Admin đã đăng nhập (UC-23); đã có ít nhất một hành động quản trị được ghi |
| Kết quả | Admin xem, lọc và đối chiếu được các hành động quản trị; bản ghi không bị sửa hoặc xóa |
| Truy vết | US-25 · FR-M7-05, FR-M7-11, NFR-08, 09, AC-29 |

**Các bước**

**Người dùng** (Admin) mở khu vực Quản trị, mục Nhật ký quản trị.

**Hệ thống** kiểm tra vai trò Admin ở phía máy chủ (NFR-08) và hiển thị danh sách bản ghi, mới nhất trước, có phân trang (FR-M7-11).

**Người dùng** lọc theo khoảng thời gian, người thực hiện, loại hành động hoặc đối tượng.

**Hệ thống** hiển thị thời điểm, người thực hiện, loại hành động, đối tượng, giá trị trước → sau và kết quả (FR-M7-05); không hiển thị mật khẩu hay token.

**Trường hợp đặc biệt**

Người không phải Admin mở khu vực này → không thấy menu, API trả 403 (NFR-08, AC-15).

Không có bản ghi khớp bộ lọc → hiển thị "Không có bản ghi".

Cố sửa hoặc xóa bản ghi → không có chức năng này; API từ chối (FR-M7-05).

#### 9.2.4. Hướng phát triển GĐ2: Screener, Portfolio, Trade Plan, Journal (UC-15 đến UC-18)

Bốn use case này thuộc giai đoạn 2 của PRD (tuần 13–20). Theo đề xuất ở phần 3, nên coi đây là hướng phát triển sau khi bảo vệ phần cốt lõi; được đặc tả đầy đủ để bám sát tài liệu.

**UC-15. Sàng lọc cổ phiếu bằng Screener**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tìm các mã theo điều kiện tín hiệu mà không cần mở từng mã |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; dự báo ngày đã chạy xong (UC-24) |
| Kết quả | Kết quả khớp 100% với truy vấn đối chiếu trên CSDL; bộ lọc đã lưu dùng được sau khi đăng nhập lại |
| Truy vết | US-15 · FR-M8-01 đến 07 · NFR-01, 13 · AC-17 |

**Các bước**

**Người dùng** chọn điều kiện lọc (kỳ hạn, nhãn dự báo, ngưỡng xác suất tối thiểu, sàn, ngành, thanh khoản) hoặc chọn một bộ lọc có sẵn, ví dụ “T+2 = Tăng, xác suất ≥ 60%”.

**Hệ thống** lọc toàn bộ danh sách mã theo điều kiện (FR-M8-01, FR-M8-03).

**Hệ thống** hiển thị kết quả: nhãn, xác suất, mức tin cậy, trạng thái dữ liệu, ngày dữ liệu; cho sắp xếp theo xác suất, thanh khoản hoặc % thay đổi (FR-M8-02).

**Người dùng** (Trader, Analyst) tự đặt điều kiện và lưu bộ lọc có tên; có thể dùng điều kiện nâng cao như đổi nhãn so với phiên trước, hit rate 90 phiên tối thiểu, trạng thái dữ liệu đầy đủ.

**Hệ thống** lưu bộ lọc, tối đa 20 bộ lọc mỗi người (FR-M8-04, AC-17), và áp dụng điều kiện nâng cao (FR-M8-05, Should).

**Người dùng** từ một dòng kết quả chọn thêm vào watchlist, mở trang chi tiết mã hoặc lập Trade Plan.

**Hệ thống** chuyển tới UC-04, UC-02 hoặc UC-17 (FR-M8-06).

**Hệ thống** hiển thị tuyên bố: đây là danh sách sàng lọc theo tín hiệu, không phải xếp hạng “nên mua”, kèm cảnh báo tham khảo (FR-M8-07, NFR-13).

**Trường hợp đặc biệt**

Không có mã thỏa điều kiện → hiển thị “Không có mã phù hợp”.

Vượt số bộ lọc tối đa → từ chối kèm thông báo.

**UC-16. Ghi giao dịch và xem danh mục (Portfolio)**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tự ghi lại giao dịch đã thực hiện và xem vị thế cùng tín hiệu hiện tại của từng mã |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; hệ thống không kết nối API công ty chứng khoán |
| Kết quả | Khối lượng, giá vốn bình quân, lãi/lỗ tạm tính và tỷ trọng khớp tính tay |
| Truy vết | US-16 · FR-M9-01 đến 06 · NFR-07, 08 · AC-18, 26 |

**Các bước**

**Người dùng** nhập giao dịch: ngày, mã, loại (mua hoặc bán), khối lượng, giá, phí; có thể sửa hoặc xóa.

**Hệ thống** lưu giao dịch gắn với tài khoản (FR-M9-01, NFR-08).

**Người dùng** (Trader, Analyst) tải tệp CSV theo mẫu.

**Hệ thống** hiển thị bản xem trước, báo rõ số dòng và lý do của từng dòng lỗi (FR-M9-02, AC-18).

**Người dùng** xác nhận import.

**Hệ thống** bỏ qua dòng lỗi, loại giao dịch trùng và ghi các dòng hợp lệ (FR-M9-02).

**Người dùng** mở trang Portfolio.

**Hệ thống** tính theo từng mã: khối lượng đang nắm, giá vốn bình quân gia quyền, giá đóng cửa gần nhất, lãi/lỗ tạm tính, lãi/lỗ đã thực hiện, tỷ trọng; ghi chú “chỉ để người dùng tự theo dõi” (FR-M9-03).

**Hệ thống** hiển thị cạnh mỗi vị thế tín hiệu T+2, T+5 hiện tại và đánh dấu khi nhãn đổi, không đưa khuyến nghị mua hoặc bán (FR-M9-04). Trader và Analyst thấy thêm tổng quan: tổng giá trị, tổng lãi/lỗ, phân bổ theo mã và ngành, giá trị danh mục theo thời gian (FR-M9-05).

**Người dùng** chọn xóa toàn bộ dữ liệu danh mục.

**Hệ thống** yêu cầu xác nhận rồi xóa (FR-M9-06).

**Trường hợp đặc biệt**

Dòng CSV sai định dạng → báo lỗi và không ghi (AC-18).

Người dùng khác hoặc Admin mở danh mục này → từ chối (403 hoặc 404) (FR-M9-06, NFR-08, AC-26).

**UC-17. Lập và theo dõi kế hoạch giao dịch (Trade Plan)**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tự lập kế hoạch (vùng vào, cắt lỗ, mục tiêu) gắn với dự báo lúc lập để giữ kỷ luật |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; mã có dự báo |
| Kết quả | Kế hoạch lưu cùng snapshot dự báo không sửa được |
| Truy vết | US-17 · FR-M10-01 đến 09 · NFR-07, 08, 13 · AC-19, 26 |

**Các bước**

**Người dùng** chọn “Lập Trade Plan” và tự nhập mã, vùng giá vào, giá cắt lỗ, giá mục tiêu và lý do.

**Hệ thống** không điền sẵn các giá trị giá (FR-M10-01, AC-19), và tính tỷ lệ lợi nhuận/rủi ro (R:R) cùng khoảng cách % từ giá vào tới cắt lỗ và mục tiêu (FR-M10-03).

**Người dùng** nhập vốn và mức rủi ro tối đa (% vốn).

**Hệ thống** tính khối lượng tối đa, làm tròn xuống theo lô 100 cổ phiếu (FR-M10-04, AC-19), và hiển thị tuyên bố “Trade Plan do bạn tự lập; hệ thống không đưa khuyến nghị đầu tư” (FR-M10-08, NFR-13).

**Người dùng** lưu kế hoạch.

**Hệ thống** chụp snapshot dự báo hiện tại (nhãn, xác suất T+2 và T+5, phiên bản mô hình, mã snapshot, thời điểm) gắn vào kế hoạch; snapshot không sửa hoặc xóa được (FR-M10-02, AC-19).

**Hệ thống** sau mỗi phiên so giá đóng cửa với vùng vào, cắt lỗ, mục tiêu và so nhãn dự báo mới với nhãn trong snapshot; gợi ý đổi trạng thái và tạo cảnh báo (FR-M10-05, FR-M10-06).

**Người dùng** xác nhận chuyển trạng thái: Nháp, Chờ vào, Đang mở, Đã đóng (chạm mục tiêu, chạm cắt lỗ, hết hạn, hủy).

**Hệ thống** cập nhật trạng thái; hệ thống chỉ gợi ý, không tự đổi (FR-M10-05).

**Người dùng** đóng kế hoạch bằng cách nhập giá thoát và ghi chú.

**Hệ thống** tự tạo bản ghi Journal (UC-18) (FR-M10-07).

**Người dùng** sửa kế hoạch khi chưa đóng.

**Hệ thống** lưu lịch sử chỉnh sửa: thời điểm, giá trị cũ, giá trị mới (FR-M10-09).

**Trường hợp đặc biệt**

Sửa hoặc xóa snapshot → bị từ chối (AC-19).

Giá cắt lỗ không thấp hơn giá vào, hoặc mục tiêu không cao hơn giá vào → từ chối và nêu lý do.

Người dùng khác hoặc Admin mở kế hoạch này → từ chối (403 hoặc 404) (NFR-08, AC-26).

**UC-18. Xem và ghi nhật ký giao dịch (Journal)**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Nhìn lại quyết định của mình so với dự báo để rút kinh nghiệm |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; có Trade Plan đã đóng (UC-17) hoặc người dùng tự ghi |
| Kết quả | Mỗi Trade Plan đã đóng có đúng một bản ghi gắn snapshot bất biến |
| Truy vết | US-18 · FR-M11-01 đến 07 · NFR-07, 08 · AC-20, 26 |

**Các bước**

**Người dùng** đóng Trade Plan (UC-17).

**Hệ thống** tự tạo đúng một bản ghi gồm: snapshot dự báo lúc lập, kế hoạch gốc, kết quả thực tế (lãi/lỗ %, số phiên nắm) và nhãn thực tế T+2, T+5 tương ứng; đóng lại lần hai không tạo bản ghi trùng (FR-M11-01, AC-20).

**Người dùng** mở bản ghi.

**Hệ thống** hiển thị dự báo lúc quyết định, hành động của người dùng (làm theo hay ngược tín hiệu) và kết quả thực tế (FR-M11-03).

**Người dùng** thêm ghi chú, thẻ (ví dụ kỷ luật, FOMO) và bài học.

**Hệ thống** lưu lại; cho sửa ghi chú nhưng không cho sửa snapshot và kết quả (FR-M11-02).

**Người dùng** lọc và tìm kiếm theo mã, khoảng thời gian, thẻ, kết quả.

**Hệ thống** hiển thị kết quả lọc (FR-M11-05).

**Người dùng** (Trader, Analyst) ghi nhật ký thủ công cho quyết định không có Trade Plan.

**Hệ thống** gắn dự báo của ngày đó vào bản ghi (FR-M11-04).

**Người dùng** (Trader, Analyst) xem thống kê theo tuần, tháng, quý.

**Hệ thống** hiển thị số kế hoạch, tỷ lệ chạm mục tiêu và cắt lỗ, tỷ lệ làm theo tín hiệu, R:R thực tế trung bình, kèm số mẫu và cảnh báo “mẫu nhỏ” (FR-M11-06).

**Trường hợp đặc biệt**

Người dùng khác hoặc Admin mở bản ghi → từ chối; Admin không xem nội dung (FR-M11-07, AC-20, AC-26).

Sửa snapshot hoặc kết quả → bị từ chối (FR-M11-02).

#### 9.2.5. Hướng phát triển GĐ2–GĐ3: Chat, PDF, thông báo, mobile (UC-19 đến UC-22)

**UC-19. Hỏi đáp bằng Chat**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Hỏi bằng tiếng Việt về dự báo, lý do, tin và lịch sử của mã và nhận câu trả lời có nguồn |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; dịch vụ mô hình ngôn ngữ khả dụng |
| Kết quả | Câu trả lời có số liệu đều kèm trích dẫn khớp bản ghi; mọi yêu cầu đưa lệnh bị từ chối |
| Truy vết | US-19 · FR-M12-01 đến 08 · NFR-13, 14 · AC-21, 22, 26 |

**Các bước**

**Người dùng** mở Chat.

**Hệ thống** hiển thị cửa sổ Chat với tuyên bố “không phải tư vấn đầu tư” (FR-M12-06, NFR-13).

**Người dùng** gõ câu hỏi tiếng Việt về dự báo, lý do, tin tức, lịch sử hoặc hit rate, hoặc về thuật ngữ trong hệ thống.

**Hệ thống** kiểm tra phiên và hạn mức lượt hỏi trong ngày, 30 lượt mỗi người (FR-M12-01, SDD).

**Hệ thống** nếu câu hỏi là yêu cầu đưa lệnh, khuyến nghị mua hoặc bán, giá mục tiêu hay tư vấn cá nhân hóa thì trả thông điệp cố định kèm gợi ý xem dự báo, giải thích hoặc Trade Plan của chính người dùng (FR-M12-03).

**Hệ thống** truy xuất dữ liệu chỉ từ hệ thống; với Portfolio, Trade Plan, Journal chỉ lấy của chính người dùng và kiểm quyền ở máy chủ trước khi đưa vào ngữ cảnh (FR-M12-02, FR-M12-05).

**Hệ thống** soạn câu trả lời chỉ từ dữ liệu đã truy xuất; mỗi số liệu kèm trích dẫn gồm mã bản ghi, ngày dữ liệu, liên kết tới màn hình hoặc bài tin (FR-M12-02, NFR-14, AC-21).

**Hệ thống** lọc đầu ra: chặn câu trả lời có khuyến nghị MUA hoặc BÁN hay giá mục tiêu do mô hình tự nêu, và ghi nhận sự kiện bị chặn (FR-M12-04, NFR-13).

**Hệ thống** trả câu trả lời trong dưới 10 giây, p95 (NFR-14), và ghi log mỗi lượt (câu hỏi, dữ liệu truy xuất, phiên bản mô hình ngôn ngữ, kết quả lọc) tối thiểu 90 ngày, không ghi mật khẩu hay token (FR-M12-07, Should).

**Trường hợp đặc biệt**

Không có dữ liệu cho câu hỏi (mã hoặc ngày không có dữ liệu) → trả lời “Hệ thống không có dữ liệu này” (FR-M12-02, AC-21).

Hết hạn mức lượt hỏi → từ chối và thông báo.

Dịch vụ mô hình ngôn ngữ lỗi hoặc quá thời gian → thông báo lỗi, không bịa câu trả lời.

Hỏi về danh mục của người dùng khác → từ chối, không tiết lộ dữ liệu (AC-26).

**UC-20. Xuất báo cáo PDF**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Lưu báo cáo mã, danh mục, Trade Plan hoặc Journal thành tệp PDF |
| Ai dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã đăng nhập; có dữ liệu cần xuất |
| Kết quả | Số liệu trong PDF khớp 100% màn hình; có tuyên bố, thời điểm dữ liệu, phiên bản mô hình |
| Truy vết | US-20 · FR-M13-01 đến 06 · NFR-13, 16 · AC-23 |

**Các bước**

**Người dùng** chọn “Xuất PDF” ở trang chi tiết mã, Portfolio, Trade Plan hoặc Journal.

**Hệ thống** kiểm tra phiên và quyền sở hữu dữ liệu cần xuất (FR-M13-06, NFR-08).

**Hệ thống** lấy số liệu từ cùng nguồn với màn hình (FR-M13-06) và dựng nội dung theo loại: báo cáo mã (dự báo, xác suất, giải thích, hit rate kèm số mẫu, trạng thái dữ liệu); báo cáo danh mục (vị thế, giá vốn, lãi/lỗ tạm tính, tỷ trọng, tín hiệu); Trade Plan (kế hoạch, R:R, snapshot); tổng kết Journal theo kỳ (FR-M13-01..04).

**Hệ thống** thêm tuyên bố “không phải tư vấn đầu tư”, thời điểm tạo, ngày dữ liệu, phiên bản mô hình và số trang (FR-M13-05, NFR-13).

**Hệ thống** sinh PDF trong dưới 10 giây (p95) với danh mục tối đa 10 mã (NFR-16).

**Người dùng** tải tệp về.

**Trường hợp đặc biệt**

Xuất dữ liệu của người khác → từ chối (403 hoặc 404) (FR-M13-06, NFR-08).

Sinh PDF lỗi hoặc quá thời gian → thông báo và cho thử lại.

**UC-21. Nhận thông báo qua email và Telegram**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Nhận cảnh báo khi không mở ứng dụng để không bỏ lỡ tín hiệu |
| Người dùng | Retail, Trader, Analyst; |
| Điều kiện trước | Đã đăng nhập; FR-M5-02..04 đã làm (điều kiện tiên quyết) |
| Kết quả | Trong 5 phút nhận đúng 1 tin trên mỗi kênh; chạy lại batch không gửi trùng |
| Truy vết | US-21 · FR-M5-06, 07, 08; FR-M10-06 · NFR-15 · AC-24 |

**Các bước**

**Người dùng** mở trang Cài đặt và chọn liên kết Telegram.

**Hệ thống** cấp mã liên kết (FR-M5-07).

**Người dùng** gửi mã cho bot Telegram.

**Hệ thống** xác nhận liên kết (FR-M5-07).

**Người dùng** xác thực email qua thư xác nhận, bật hoặc tắt từng kênh, và có thể gửi thử hoặc hủy liên kết.

**Hệ thống** lưu thiết lập kênh (FR-M5-06, FR-M5-07).

**Hệ thống** (sau mỗi lần dự báo) với mỗi cảnh báo mới (đổi nhãn, vượt ngưỡng, sự kiện Trade Plan) tạo thông báo cho mỗi kênh đang bật (FR-M5-06, FR-M10-06).

**Hệ thống** gửi trong 5 phút sau khi dự báo xong bằng dịch vụ gửi chạy riêng (NFR-15); mỗi sự kiện chỉ gửi một lần cho mỗi kênh dù batch chạy lại; lỗi kênh thì thử lại tối đa 3 lần và ghi log gửi (FR-M5-08, NFR-15).

**Người dùng** bấm vào tin nhận được.

**Hệ thống** mở đúng mã trong ứng dụng; nội dung khớp cảnh báo trong ứng dụng (AC-24).

**Trường hợp đặc biệt**

Gửi lỗi sau 3 lần → ghi trạng thái lỗi; cảnh báo trong ứng dụng vẫn hiển thị (FR-M5-08).

Mã liên kết sai hoặc hết hạn → từ chối và yêu cầu cấp mã mới.

**UC-22. Dùng ứng dụng trên điện thoại**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Xem dự báo và quản lý watchlist trên iOS và Android |
| Người dùng | Retail, Trader, Analyst |
| Điều kiện trước | Đã cài bản build iOS hoặc Android; tài khoản đã được tạo (UC-12) |
| Kết quả | Các thao tác chính hoàn tất trên cả hai nền tảng với dữ liệu giống web |
| Truy vết | US-22 · FR-M14-01 đến 05 · NFR-10, 17 · AC-25 |

**Các bước**

**Người dùng** đăng nhập trên ứng dụng.

**Hệ thống** trả token; ứng dụng lưu trong Keychain (iOS) hoặc Keystore (Android) (FR-M14-04), và dùng chung API, mô hình dữ liệu, phân quyền với web (FR-M14-01).

**Người dùng** điều hướng bằng thanh tab: Tổng quan, Watchlist, Portfolio, Trade Plan, Thêm (Journal, Chat, Thông báo, Cài đặt).

**Hệ thống** hiển thị các màn hình cốt lõi (FR-M14-02).

**Người dùng** mở chi tiết mã.

**Hệ thống** hiển thị thẻ dự báo và giải thích trong dưới 3 giây (p95) trên mạng 4G (FR-M14-02, NFR-17), cùng tuyên bố trách nhiệm và thời điểm cập nhật dữ liệu như web (FR-M14-05).

**Người dùng** dùng Screener hoặc xem và chia sẻ PDF.

**Hệ thống** hiển thị Screener và mở menu chia sẻ của hệ điều hành (FR-M14-03).

**Người dùng** đăng xuất.

**Hệ thống** xóa token cục bộ (FR-M14-04).

**Trường hợp đặc biệt**

Token hết hạn sau 24 giờ → yêu cầu đăng nhập lại.

Build iOS chậm → dùng web responsive từ 375 px hoặc PWA làm phương án dự phòng.

#### 9.2.6. Đăng ký và vòng đời tài khoản (UC-26 đến UC-29)

Nguyên tắc: tách tài khoản khỏi quyền (đăng ký công khai chỉ tạo retail); quyền càng nhạy cảm kiểm soát càng chặt; không để lộ email đã tồn tại; thu thập tối thiểu; mọi sự đồng ý có bằng chứng và rút lại được; máy chủ quyết định vai trò. Căn cứ pháp lý ở §7.2 (C6).

**Quy tắc nghiệp vụ**

| Mã | Quy tắc |
| --- | --- |
| BR-R01 | Chỉ vai trò retail được tự đăng ký công khai. Trường role trong yêu cầu đăng ký bị máy chủ bỏ qua. |
| BR-R02 | Email duy nhất sau khi chuẩn hóa (cắt khoảng trắng, chữ thường), tối đa 254 ký tự. |
| BR-R03 | Mật khẩu theo FR-M0-06 (8–64 ký tự, có chữ, số, ký tự đặc biệt), băm bằng hàm băm chậm có salt (triển khai: scrypt). |
| BR-R04 | Bắt buộc tự khai đủ 18 tuổi; không thu thập ngày sinh. |
| BR-R05 | Bắt buộc tick riêng Điều khoản sử dụng và Thông báo xử lý dữ liệu; không chọn sẵn; không gộp với đồng ý tùy chọn. |
| BR-R06 | Nhận thông báo email/Telegram là tùy chọn, mặc định tắt, bật/tắt trong Cài đặt → Kênh thông báo. |
| BR-R07 | Tài khoản chưa xác thực email không đăng nhập được. Token xác thực một lần, hết hạn 24 giờ, chỉ lưu SHA-256; gửi lại tối đa 5 lần mỗi ngày, cách nhau ≥ 60 giây. |
| BR-R08 | Phản hồi đăng ký luôn cùng thông điệp, không phân biệt email đã tồn tại hay chưa; email đã tồn tại nhận thư "Bạn đã có tài khoản". |
| BR-R09 | Tối đa 5 lần đăng ký mỗi giờ theo IP và theo email (khóa đếm lưu dạng băm HMAC); captcha khi vượt ngưỡng. |
| BR-R10 | Không thu thập CCCD, số tài khoản chứng khoán hoặc ngân hàng, số điện thoại. |
| BR-R11 | Tài khoản chưa xác thực quá 7 ngày bị xóa (dọn ở đầu mỗi lượt đăng ký mới). |
| BR-R12 | Nâng lên trader: tự phục vụ, bắt buộc khai kinh nghiệm, mục đích và tick xác nhận trách nhiệm; ghi đồng ý Điều khoản Trader, nhật ký; thu hồi phiên. Tự hạ cấp được. |
| BR-R13 | Nâng lên analyst: Admin duyệt; bắt buộc tổ chức, chức danh, email cơ quan, mục đích, đồng ý Điều khoản Analyst (không phát tán dữ liệu truy vết, không dùng dữ liệu tin tức ngoài mục đích nghiên cứu theo C3); tối đa 1 yêu cầu đang chờ; từ chối phải có lý do; nộp lại sau 7 ngày; mục tiêu xử lý trong 3 ngày làm việc. |
| BR-R14 | Người duyệt không được trùng người yêu cầu. |
| BR-R15 | Tạo hoặc nâng quyền admin: chỉ Admin hiện có thực hiện; tài khoản mới nhận mật khẩu tạm, buộc đổi lần đầu; luôn còn ít nhất một Admin hoạt động. Nhập lại mật khẩu, chỉ email tổ chức, TOTP, hai người xác nhận là Should (FR-M0-15). |
| BR-R16 | Bootstrap Admin đầu tiên chỉ chạy được khi chưa có Admin; không có endpoint công khai nào tạo admin. |
| BR-R17 | Mọi thay đổi vai trò thu hồi toàn bộ phiên và ghi nhật ký quản trị (ai, trước, sau). |
| BR-R18 | Mỗi lần đồng ý ghi loại văn bản, phiên bản, thời điểm, kênh. Phiên bản văn bản đổi thì yêu cầu đồng ý lại ở lần đăng nhập sau (Should). |
| BR-R19 | Người dùng tự xóa tài khoản, xác nhận bằng mật khẩu; xóa watchlist, Portfolio, Trade Plan, Journal, Chat, kênh thông báo; nhật ký giữ dạng ẩn danh (NFR-09). Admin không tự xóa được. |
| BR-R20 | Có quy trình thông báo sự cố lộ lọt dữ liệu trong 72 giờ cho cơ quan chuyên trách và người dùng. |

**Dữ liệu thu thập**

| Trường | Bắt buộc | Mục đích | Lưu trữ |
| --- | --- | --- | --- |
| Email | Có | Đăng nhập, xác thực, gửi thông báo | Duy nhất, chuẩn hóa |
| Mật khẩu | Có | Đăng nhập | Chỉ lưu bản băm |
| Tên hiển thị | Không | Hiển thị trong ứng dụng | Có thể để trống |
| Tự khai đủ 18 tuổi | Có | Điều kiện sử dụng | Lưu thời điểm khai, không lưu ngày sinh |
| Đồng ý điều khoản và xử lý dữ liệu | Có | Cơ sở xử lý dữ liệu | Bản ghi đồng ý có phiên bản |
| Tổ chức, chức danh, email cơ quan | Chỉ khi xin analyst | Duyệt quyền | Xóa khi tài khoản bị xóa |
| Bộ đếm đăng ký theo IP/email | Hệ thống tự ghi | Chống lạm dụng | Chỉ lưu dạng băm, tự xóa sau 24 giờ |

**Trạng thái tài khoản:** chưa xác thực (đã đăng ký, chưa bấm liên kết) → hoạt động (bấm liên kết) hoặc bị xóa (quá 7 ngày); hoạt động ↔ bị khóa (Admin khóa/mở, FR-M7-01); hoạt động → đã xóa (người dùng tự xóa, chỉ còn nhật ký ẩn danh). Yêu cầu nâng quyền: chờ duyệt → đã duyệt hoặc bị từ chối.

**Lưu ý với môi giới:** người làm tại công ty chứng khoán được nhắc rằng IDSS không thay thế nghĩa vụ tuân thủ của công ty; dự báo và Trade Plan không được dùng như khuyến nghị cá nhân hóa gửi khách hàng (Luật Chứng khoán 2019).

**Tài khoản demo:** tạo bằng lệnh seed trước buổi bảo vệ, chỉ chứa dữ liệu mẫu; chạy lại seed đặt lại mật khẩu và mở khóa.

**UC-26. Tự đăng ký và xác thực email**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Người chưa có tài khoản tự tạo tài khoản retail mà không cần Admin |
| Người dùng | Khách (chưa có tài khoản) |
| Điều kiện trước | Chưa có tài khoản với email này; hệ thống đã cấu hình gửi email (SMTP) |
| Kết quả | Tài khoản retail đã xác thực email, có bản ghi đồng ý điều khoản và xử lý dữ liệu; đăng nhập được |
| Truy vết | US-26 · FR-M0-06, 08, 09, 10 · NFR-07, 09, 18 · AC-31, AC-32, AC-33, AC-34 · C6 |

**Các bước**

**Người dùng** mở trang Đăng nhập, chọn "Chưa có tài khoản? Đăng ký".

**Người dùng** nhập email, tên hiển thị (không bắt buộc), mật khẩu và nhập lại mật khẩu.

**Người dùng** tick riêng 3 ô bắt buộc, không chọn sẵn: đủ 18 tuổi; đồng ý Điều khoản sử dụng và hiểu hệ thống không phải tư vấn đầu tư; đã đọc Thông báo xử lý dữ liệu cá nhân và đồng ý (FR-M0-10, C6).

**Hệ thống** kiểm tra định dạng email, chuẩn hóa email, chính sách mật khẩu ở cả giao diện và máy chủ (FR-M0-06) và giới hạn tần suất (FR-M0-08).

**Hệ thống** luôn trả cùng một thông điệp "Nếu email hợp lệ, chúng tôi đã gửi email xác thực tài khoản" (FR-M0-08). Email chưa tồn tại: tạo tài khoản retail chưa xác thực, lưu bản ghi đồng ý, gửi thư chứa liên kết xác thực một lần, hết hạn 24 giờ (FR-M0-09). Email đã tồn tại: gửi thư "Bạn đã có tài khoản", không tạo tài khoản mới.

**Người dùng** mở thư và bấm liên kết.

**Hệ thống** kiểm tra liên kết còn hạn và chưa dùng, đánh dấu email đã xác thực, ghi nhật ký và mời người dùng đăng nhập (UC-23).

**Trường hợp đặc biệt**

Mật khẩu không đạt chính sách hoặc thiếu ô đồng ý bắt buộc → không gửi được biểu mẫu, báo rõ lý do.

Đăng nhập khi chưa xác thực → bị từ chối (AC-33); trang xác thực cho gửi lại thư, tối đa 5 lần mỗi ngày, cách nhau ít nhất 60 giây.

Liên kết hết hạn hoặc đã dùng → báo "Liên kết xác thực không hợp lệ hoặc đã hết hạn" và cho gửi lại.

Vượt 5 lần đăng ký mỗi giờ theo IP hoặc email → vẫn trả thông điệp chung nhưng không tạo tài khoản, không gửi thư.

Yêu cầu đăng ký có kèm trường vai trò (ví dụ admin) → bị bỏ qua, tài khoản vẫn là retail (AC-34).

Tài khoản chưa xác thực quá 7 ngày → bị xóa cùng bản ghi đồng ý (dọn ở lượt đăng ký kế tiếp).

**UC-27. Nâng cấp Trader, yêu cầu quyền Analyst**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Người dùng mở thêm công cụ phù hợp nhu cầu mà vẫn giữ kiểm soát quyền nhạy cảm |
| Người dùng | Retail (nâng Trader, xin Analyst), Trader (hạ về Retail, xin Analyst) |
| Điều kiện trước | Đã đăng nhập (UC-23); khi xin Analyst: không có yêu cầu nào đang chờ và không bị từ chối trong 7 ngày gần nhất |
| Kết quả | Vai trò Trader có hiệu lực ngay sau khi đăng nhập lại; yêu cầu Analyst ở trạng thái chờ Admin duyệt |
| Truy vết | US-27 · FR-M0-03, 10, 11 · NFR-08 · AC-35, AC-36 · UC-28 |

**Các bước**

**Người dùng** mở Cài đặt → Tài khoản & vai trò.

**Hệ thống** hiển thị vai trò hiện tại, quyền được mở thêm khi nâng cấp và các yêu cầu đã gửi.

**Người dùng** (Retail) chọn kinh nghiệm giao dịch, mục đích sử dụng, tick xác nhận trách nhiệm và chọn "Nâng cấp lên Trader".

**Hệ thống** đổi vai trò thành trader, lưu bản ghi đồng ý điều khoản Trader, ghi nhật ký, thu hồi mọi phiên; người dùng đăng nhập lại (FR-M0-11, FR-M0-03).

**Người dùng** (Retail hoặc Trader) nhập tổ chức, chức danh, email cơ quan, mục đích, tick đồng ý Điều khoản dành cho Analyst và chọn "Gửi yêu cầu".

**Hệ thống** lưu yêu cầu ở trạng thái chờ duyệt; vai trò chưa đổi cho đến khi Admin duyệt (UC-28).

**Trường hợp đặc biệt**

Chưa tick xác nhận trách nhiệm → không nâng cấp được.

Đã có yêu cầu đang chờ → từ chối gửi thêm.

Bị từ chối trong 7 ngày gần nhất → báo thời điểm được nộp lại.

Trader muốn quay về Retail → chọn "Hạ cấp về Nhà đầu tư cá nhân"; dữ liệu đã nhập được giữ, công cụ Trader bị ẩn, phiên bị thu hồi.

**UC-28. Duyệt hoặc từ chối yêu cầu nâng quyền**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Chỉ người có thẩm quyền mới mở dữ liệu truy vết nội bộ cho Analyst |
| Người dùng | Admin |
| Điều kiện trước | Admin đã đăng nhập; có yêu cầu đang chờ (UC-27) |
| Kết quả | Yêu cầu được duyệt (vai trò đổi thành Analyst) hoặc từ chối có lý do; có nhật ký |
| Truy vết | US-28 · FR-M0-12, FR-M7-05, 11 · NFR-08 · AC-36 · UC-25 |

**Các bước**

**Người dùng** (Admin) mở Quản trị → tab "Yêu cầu nâng quyền".

**Hệ thống** liệt kê yêu cầu theo trạng thái, kèm người yêu cầu, tổ chức, chức danh, email cơ quan, mục đích, ngày gửi.

**Người dùng** đối chiếu thông tin (tên miền email với tổ chức, mục đích hợp lý) rồi chọn "Duyệt" hoặc "Từ chối" và nhập lý do.

**Hệ thống** khi duyệt: đổi vai trò người yêu cầu thành analyst, thu hồi phiên của họ, ghi nhật ký quản trị (người duyệt, trước, sau). Khi từ chối: giữ vai trò, lưu lý do, ghi nhật ký (FR-M0-12).

**Trường hợp đặc biệt**

Từ chối mà không nhập lý do → không cho gửi.

Admin duyệt yêu cầu của chính mình → bị chặn.

Yêu cầu đã được xử lý → báo đã xử lý, không đổi lại.

**UC-29. Tạo Admin, xem đồng ý và xóa tài khoản**

| Mục | Nội dung |
| --- | --- |
| Mục tiêu | Tạo Admin có kiểm soát; người dùng thực hiện quyền của chủ thể dữ liệu |
| Người dùng | Người triển khai, Admin; Retail, Trader, Analyst |
| Điều kiện trước | Khi bootstrap: chưa có Admin nào. Khi xem đồng ý hoặc xóa tài khoản: đã đăng nhập |
| Kết quả | Có Admin hợp lệ; người dùng xem được lịch sử đồng ý; tài khoản và dữ liệu cá nhân bị xóa theo yêu cầu |
| Truy vết | US-28, US-29 · FR-M0-10, 13, 14, 15 · NFR-07, 09, 18 · AC-37, AC-38, AC-39 · C6 |

**Các bước**

**Người triển khai** chạy lệnh bootstrap với email và mật khẩu Admin lấy từ biến môi trường; hệ thống chỉ tạo khi chưa có Admin nào (FR-M0-14).

**Người dùng** (Admin hiện có) tạo thêm Admin trong Quản trị (UC-12); tài khoản mới nhận mật khẩu tạm và buộc đổi lần đầu.

**Người dùng** (mọi vai trò trừ Admin) mở Cài đặt → Tài khoản & vai trò, xem bảng "Đồng ý đã lưu" gồm loại văn bản, phiên bản, thời điểm (FR-M0-10).

**Người dùng** chọn "Xóa tài khoản của tôi" và nhập lại mật khẩu để xác nhận.

**Hệ thống** xóa tài khoản cùng watchlist, Portfolio, Trade Plan, Journal, Chat, kênh thông báo; nhật ký quản trị liên quan được giữ ở dạng ẩn danh; phiên bị hủy (FR-M0-13).

**Trường hợp đặc biệt**

Chạy bootstrap khi đã có Admin → bị từ chối.

Xóa tài khoản sai mật khẩu → bị từ chối, không xóa gì.

Admin tự xóa tài khoản → bị chặn; khóa hoặc hạ quyền Admin cuối cùng → bị chặn (UC-12).

Muốn ngừng nhận thông báo → tắt kênh trong Cài đặt → Kênh thông báo (rút đồng ý tùy chọn); rút đồng ý bắt buộc tương đương xóa tài khoản.

## 10. Functional requirements theo module

Hệ thống chia thành 15 module: M0–M7 thuộc GĐ1, M8–M13 thuộc GĐ2, M14 thuộc GĐ3; mỗi yêu cầu có mã, vai trò được dùng và mức ưu tiên. Vai trò: R = retail, T = trader, A = analyst, Ad = admin, Khách = người chưa có tài khoản. Ở các module quyết định (M9–M11), retail dùng bản rút gọn; yêu cầu ghi vai trò T, A là bản đầy đủ

### M0. Xác thực

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M0-01 | Đăng nhập bằng email và mật khẩu; cấp phiên hiệu lực tối đa 24 giờ; vai trò và trạng thái khóa của tài khoản được máy chủ kiểm tra lại ở mỗi request; khi sai thì chỉ hiện thông báo chung, không nêu trường nào sai | Tất cả | Must |
| FR-M0-02 | Đăng xuất: hủy phiên; trên mobile xóa token cục bộ | Tất cả | Must |
| FR-M0-03 | Từ chối đăng nhập tài khoản bị khóa; việc khóa hoặc đổi vai trò có hiệu lực ngay (thu hồi phiên đang dùng) | Tất cả | Must |
| FR-M0-04 | Mỗi tài khoản đăng nhập sai 5 lần liên tiếp trong 15 phút thì bị khóa tạm 15 phút. Trong thời gian khóa, kể cả nhập đúng cũng bị từ chối với thông báo chung. Số lần sai về 0 khi đăng nhập đúng. Mỗi lần sai và mỗi lần khóa tạm được ghi nhật ký bảo mật. | Tất cả | Must |
| FR-M0-05 | Người dùng đã đăng nhập đổi mật khẩu bằng cách nhập mật khẩu hiện tại và mật khẩu mới. Thành công thì mọi phiên khác của tài khoản bị thu hồi và sự kiện được ghi log. | Tất cả | Must |
| FR-M0-06 | Chính sách mật khẩu: 8–64 ký tự, có chữ, số và ít nhất 1 ký tự đặc biệt; kiểm tra ở cả giao diện và máy chủ; mật khẩu mới khi đổi hoặc đặt lại phải khác mật khẩu hiện tại. | Tất cả | Must |
| FR-M0-07 | Đặt lại mật khẩu: Admin đặt mật khẩu tạm cho người dùng, mọi phiên cũ bị thu hồi, người dùng bị buộc đổi ở lần đăng nhập kế tiếp. Tự đặt lại qua email: liên kết dùng một lần, hết hạn 30 phút | Tất cả | Should |
| FR-M0-08 | Tự đăng ký công khai bằng email, mật khẩu, tên hiển thị (tùy chọn) và 3 ô đồng ý bắt buộc (đủ 18 tuổi, Điều khoản sử dụng, Thông báo xử lý dữ liệu). Chỉ tạo tài khoản retail; trường vai trò trong yêu cầu bị bỏ qua. Luôn trả cùng một thông điệp; email đã tồn tại thì gửi thư "Bạn đã có tài khoản" và không tạo mới. Giới hạn 5 lần đăng ký mỗi giờ theo IP và theo email | Khách | Must |
| FR-M0-09 | Xác thực email bằng liên kết một lần, hết hạn 24 giờ, chỉ lưu bản băm SHA-256 của mã. Chưa xác thực thì không đăng nhập được. Gửi lại tối đa 5 lần mỗi ngày, cách nhau ≥ 60 giây. Tài khoản chưa xác thực quá 7 ngày tự xóa | Khách, R | Must |
| FR-M0-10 | Ghi nhận mỗi lần đồng ý (loại văn bản, phiên bản, thời điểm, kênh) khi đăng ký và khi nâng cấp vai trò; người dùng xem lại lịch sử đồng ý trong Cài đặt. Khi phiên bản văn bản đổi thì yêu cầu đồng ý lại ở lần đăng nhập sau (Should) | R, T, A | Must |
| FR-M0-11 | Retail tự nâng cấp lên Trader sau khi khai kinh nghiệm, mục đích và xác nhận trách nhiệm; Trader tự hạ về Retail, giữ dữ liệu. Retail hoặc Trader gửi yêu cầu quyền Analyst (tổ chức, chức danh, email cơ quan, mục đích, đồng ý Điều khoản Analyst); tối đa 1 yêu cầu đang chờ; bị từ chối thì nộp lại sau 7 ngày. Mọi đổi vai trò thu hồi phiên và ghi nhật ký | R, T | Must |
| FR-M0-12 | Admin xem danh sách yêu cầu nâng quyền theo trạng thái, duyệt hoặc từ chối (bắt buộc lý do khi từ chối); không tự duyệt yêu cầu của chính mình; duyệt thì đổi vai trò và thu hồi phiên người yêu cầu; mọi quyết định ghi nhật ký quản trị | Ad | Must |
| FR-M0-13 | Người dùng tự xóa tài khoản sau khi nhập lại mật khẩu: xóa watchlist, Portfolio, Trade Plan, Journal, Chat, kênh thông báo; nhật ký quản trị giữ dạng ẩn danh; Admin không tự xóa được | R, T, A | Must |
| FR-M0-14 | Admin đầu tiên chỉ tạo bằng lệnh bootstrap khi triển khai (đọc thông tin từ biến môi trường, tự chặn khi đã có Admin); không có endpoint công khai nào tạo admin; Admin tiếp theo do Admin hiện có tạo với mật khẩu tạm và buộc đổi lần đầu; luôn còn ít nhất một Admin hoạt động | Ad | Must |
| FR-M0-15 | Tăng cường bảo vệ tài khoản: Admin nhập lại mật khẩu trước khi tạo hoặc nâng quyền Admin, chỉ dùng email tổ chức; xác thực hai lớp (TOTP) cho Admin; xác nhận email cơ quan bằng thư trước khi Admin xét yêu cầu Analyst; thư báo kết quả duyệt; captcha khi vượt ngưỡng đăng ký | Ad, Khách | Should |

### M1. Market overview

Màn hình: Trang chủ / Tổng quan thị trường. Dữ liệu: danh mục mã, giá đóng cửa, thanh khoản 20 phiên, dự báo mới nhất.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M1-01 | Hiển thị danh sách mã mục tiêu: mã, tên công ty, sàn, ngành, giá đóng cửa, % thay đổi, GTGD bình quân 20 phiên. | R, T, A | Must |
| FR-M1-02 | Lọc theo sàn (HOSE/HNX/UPCoM), ngành, thanh khoản, xu hướng dự báo (tăng/đi ngang/giảm) và kỳ hạn. | R, T, A | Must |
| FR-M1-03 | Hiển thị tín hiệu mới nhất T+2 và T+5 mỗi mã bằng nhãn màu + xác suất của lớp được chọn. | R, T, A | Must |
| FR-M1-04 | Sắp xếp theo xác suất tăng/giảm, thanh khoản, % thay đổi; tìm kiếm theo mã/tên. | R, T, A | Must |
| FR-M1-05 | Hiển thị ngày dữ liệu và thời điểm cập nhật dự báo gần nhất ở đầu trang. | Tất cả | Must |
| FR-M1-06 | Hiển thị dải thị trường ở đầu trang: VN-Index, HNX-Index, độ rộng thị trường (số mã tăng/giảm) và tỷ lệ mã theo nhãn dự báo. | Tất cả | Should (GĐ2) |
| FR-M1-07 | Khối “Tín hiệu đổi hôm nay”: các mã đổi nhãn so với phiên trước; bấm vào để mở trang chi tiết mã. | R, T, A | Should (GĐ2) |

### M2. Forecast card & trang chi tiết mã

Màn hình: Trang chi tiết mã. Dữ liệu: bản ghi dự báo, giá lịch sử. Đầu ra: forecast card cho từng kỳ hạn.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M2-01 | Hiển thị nhãn dự báo tăng / đi ngang / giảm cho kỳ hạn đang chọn. | Tất cả | Must |
| FR-M2-02 | Hiển thị xác suất cả 3 lớp (tổng = 100%) dạng thanh ngang. | Tất cả | Must |
| FR-M2-03 | Hiển thị thời điểm sinh dự báo, ngày dữ liệu cơ sở (T) và ngày đáo hạn (T+2 hoặc T+5 theo lịch giao dịch). | Tất cả | Must |
| FR-M2-04 | Hiển thị cảnh báo cố định “Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư”. | Tất cả | Must |
| FR-M2-05 | Hiển thị T+2 và T+5 cạnh nhau trên trang chi tiết mã (hai forecast card), đánh dấu khi hai kỳ hạn mâu thuẫn. | Tất cả | Must |
| FR-M2-06 | Biểu đồ giá nến/đường 6 tháng với khối lượng, đánh dấu các ngày có tin mạnh. | Tất cả | Must |
| FR-M2-07 | Hiển thị trạng thái dữ liệu (đầy đủ / thiếu tin / thiếu BCTC / dữ liệu cũ) và độ tin cậy của dự báo. | Tất cả | Must |
| FR-M2-08 | Hiển thị mức tin cậy 3 bậc (cao/trung bình/thấp) tính từ xác suất lớp cao nhất, mức đồng thuận T+2/T+5 và trạng thái dữ liệu; gắn nhãn “độ tin cậy thấp” khi xác suất cao nhất < 45%. | Tất cả | Should (GĐ2) |
| FR-M2-09 | Khối “Điều gì có thể làm dự báo sai”: liệt kê 2–3 yếu tố cụ thể theo quy tắc (ví dụ sắp công bố BCTC, thiếu tin, thanh khoản thấp, T+2 và T+5 mâu thuẫn, hit rate gần đây thấp); không dùng từ “MUA”/“BÁN”. | Tất cả | Should (GĐ2) |

### M3. Explainability

Màn hình: khối “Vì sao?” trong trang chi tiết; tab Analyst. Dữ liệu: giá trị SHAP/attribution theo đặc trưng và nhóm.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M3-01 | Hiển thị tỷ trọng đóng góp của 3 nhóm: tài chính cơ bản, kỹ thuật (giá/khối lượng), tin tức/cảm xúc; và tối thiểu 3 yếu tố ảnh hưởng lớn nhất kèm chiều (đẩy lên/kéo xuống). | Tất cả | Must |
| FR-M3-02 | Analyst xem đóng góp chi tiết top 15 đặc trưng, giá trị thô của đặc trưng và trọng số attention trên các tin. | A | Must |
| FR-M3-03 | Retail xem bản giải thích đơn giản hóa: 3 câu tiếng Việt sinh từ mẫu (template), không dùng thuật ngữ như SHAP, RSI không có chú thích. | R | Must |
| FR-M3-04 | Không hiển thị giải thích cho nhóm dữ liệu bị thiếu; ghi rõ “Không có dữ liệu tin tức trong 5 phiên gần nhất”. | Tất cả | Must |

### M4. News & sentiment

Màn hình: tab Tin tức trong trang chi tiết. Dữ liệu: bài viết, liên kết mã–bài, điểm cảm xúc, cảm xúc tổng hợp ngày.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M4-01 | Thu thập và gom tin liên quan đến từng mã (tiêu đề, nguồn, thời gian, URL, tóm tắt), loại trùng lặp. | Hệ thống | Must |
| FR-M4-02 | Phân loại sắc thái tích cực / trung tính / tiêu cực kèm độ tin cậy cho mỗi tin. | Hệ thống | Must |
| FR-M4-03 | Hiển thị danh sách tin mới nhất trước, nhãn màu sắc thái, lọc theo sắc thái và khoảng ngày; mở bài gốc ở tab mới. | Tất cả | Must |
| FR-M4-04 | Biểu đồ chỉ số cảm xúc theo ngày 30 phiên cạnh giá. | Tất cả | Must |
| FR-M4-05 | Gắn mức ảnh hưởng tương đối của từng tin tới dự báo (trọng số attention) nếu mô hình cung cấp. | T, A | Should |
| FR-M4-06 | Áp dụng cut-off 15:00: tin sau 15:00 ngày T chỉ được dùng cho dự báo từ ngày T+1. | Hệ thống | Must |

### M5. Watchlist & alerts

Màn hình: trang Watchlist, biểu tượng chuông thông báo. Dữ liệu: watchlist theo người dùng, quy tắc cảnh báo, lịch sử cảnh báo. Kênh ngoài ứng dụng (email, Telegram) thuộc GĐ2; FR-M5-02..04 là điều kiện tiên quyết của FR-M5-06, nếu chưa làm ở GĐ1 thì làm ở đầu GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M5-01 | Thêm/xóa mã khỏi watchlist từ overview hoặc trang chi tiết; tối đa 10 mã/người dùng. | R, T, A | Must |
| FR-M5-02 | Đánh dấu mã khi nhãn dự báo đổi so với phiên trước (ví dụ đi ngang → tăng). Tạo cảnh báo gồm mã, kỳ hạn, nhãn cũ hiển thị trong ứng dụng trong vòng 5 phút sau khi dự báo của ngày hoàn tất | R, T, A | Must |
| FR-M5-03 | Người dùng đặt ngưỡng xác suất (ví dụ P(tăng) ≥ 60%) cho từng mã/kỳ hạn; hệ thống tạo cảnh báo khi vượt ngưỡng. | R, T, A | Must |
| FR-M5-04 | Lưu và hiển thị lịch sử cảnh báo 90 ngày (thời gian, mã, nội dung, đã đọc/chưa). | R, T, A | Must |
| FR-M5-05 | Cảnh báo hiển thị trong ứng dụng (biểu tượng chuông và danh sách thông báo). | R, T, A | Must |
| FR-M5-06 | Gửi cảnh báo ra ngoài ứng dụng qua email và Telegram cho cùng các sự kiện của FR-M5-02, FR-M5-03 và FR-M10-06; người dùng bật/tắt từng kênh. | R, T, A | Must (GĐ2) |
| FR-M5-07 | Liên kết Telegram bằng bot (người dùng gửi mã liên kết) và xác thực email; có nút gửi thử và hủy liên kết. Admin cũng liên kết được kênh của mình để nhận thông báo lỗi pipeline (FR-M7-08). | R, T, A, Ad | Must (GĐ2) |
| FR-M5-08 | Chống gửi trùng: mỗi sự kiện chỉ gửi một lần cho mỗi kênh dù batch chạy lại; retry tối đa 3 lần khi lỗi kênh và ghi log gửi (thời gian, kênh, trạng thái). | Hệ thống | Must (GĐ2) |

### M6. Backtest / forecast history

Màn hình: tab Lịch sử trong trang chi tiết; trang Đánh giá mô hình. Dữ liệu: bản ghi dự báo cũ, nhãn thực tế sau khi đủ kỳ hạn, metrics các lần chạy.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M6-01 | Hiển thị lịch sử dự báo của mã: ngày, kỳ hạn, nhãn dự báo, xác suất, nhãn thực tế, đúng/sai. | Tất cả | Must |
| FR-M6-02 | Tự động điền nhãn thực tế khi đủ 2 hoặc 5 phiên; dự báo chưa đáo hạn ghi “Đang chờ”. | Hệ thống | Must |
| FR-M6-03 | Tính hit rate, precision và recall theo lớp cho mỗi mã và toàn bộ, trong cửa sổ 30/90 phiên. | Tất cả | Must |
| FR-M6-04 | Trang Đánh giá mô hình: Accuracy, Macro F1, Precision, Recall, AUC-ROC, confusion matrix; so sánh baseline vs đa phương thức và 3 cấu hình ablation. | A, Ad | Must |
| FR-M6-05 | Xuất lịch sử dự báo ra CSV. | A | Should |
| FR-M6-06 | Cạnh mỗi hit rate hiển thị số mẫu n của cửa sổ; khi n < 50 hiển thị cảnh báo “mẫu nhỏ”; hiển thị cạnh đó baseline “lớp phổ biến nhất” trong cùng cửa sổ; ghi chú rằng dự báo T+5 chồng lấn nên số mẫu độc lập ít hơn n. (cần xác nhận ngưỡng 50) | Tất cả | Must |
| FR-M6-07 | Trang Đánh giá mô hình: biểu đồ hiệu chỉnh xác suất (reliability diagram), Brier score và ECE cho từng kỳ hạn. | A, Ad | Should (GĐ2) |

### M7. Admin / model ops tối thiểu

Màn hình: khu vực Quản trị (chỉ admin), tab Audit trong trang chi tiết (analyst xem).

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M7-01 | Quản lý người dùng: tạo, khóa, đổi vai trò (retail/trader/analyst/admin). | Ad | Must |
| FR-M7-02 | Quản lý nguồn dữ liệu: danh sách nguồn, lần chạy ETL gần nhất, số bản ghi, lỗi; chạy lại thủ công một job. | Ad | Must |
| FR-M7-03 | Theo dõi phiên bản mô hình: mã phiên bản, ngày huấn luyện, khoảng dữ liệu, metrics. | Ad (A xem) | Must |
| FR-M7-04 | Audit log: mỗi dự báo và mỗi lần chạy mô hình lưu timestamp, phiên bản mô hình, mã snapshot dữ liệu, trạng thái, người/job kích hoạt. | Hệ thống (A, Ad xem) | Must |
| FR-M7-05 | Ghi nhật ký mọi hành động của Admin: tạo tài khoản, khóa/mở khóa, đổi vai trò, đặt lại mật khẩu, thu hồi phiên, chạy lại job thủ công, chọn hoặc quay lại phiên bản mô hình. Mỗi bản ghi gồm thời điểm, người thực hiện, loại hành động, đối tượng, giá trị trước → sau và kết quả; không ghi mật khẩu hay token. Bản ghi chỉ được thêm, không sửa hoặc xóa; lưu tối thiểu 90 ngày (NFR-09). | Hệ thống | Must |
| FR-M7-06 | Chọn phiên bản mô hình đang phục vụ và rollback về phiên bản trước. | Ad | Should |
| FR-M7-07 | Tự chạy pipeline sau 15:30 mỗi ngày giao dịch (giá, tin, báo cáo tài chính, sắc thái, đặc trưng, nhãn thực tế, dự báo, cảnh báo); mỗi lần chạy ghi mã job, trạng thái, số bản ghi | Hệ thống | Must |
| FR-M7-08 | Khi pipeline lỗi sau 3 lần thử, báo cho admin (hiển thị ở trang nguồn dữ liệu và gửi thông báo) | Hệ thống | Should |
| FR-M7-09 | Với một dự báo, hiển thị dữ liệu đầu vào đã dùng: giá và đặc trưng kỹ thuật, chỉ số tài chính, danh sách tin tham chiếu (tiêu đề, nguồn, thời điểm đăng), mã snapshot, thời điểm cut-off | A, Ad | Must |
| FR-M7-10 | Chạy lại một dự báo bằng đúng phiên bản mô hình và snapshot đã lưu, so xác suất mới với xác suất đã lưu và báo "đạt" khi sai số < 1e-4. Kết quả chạy lại được ghi riêng, không ghi đè dự báo gốc. Nếu snapshot hoặc phiên bản mô hình không còn thì báo "không tái lập được" và ghi log | A, Ad | Must |
| FR-M7-11 | Admin xem nhật ký quản trị, lọc theo khoảng thời gian, người thực hiện, loại hành động và đối tượng, có phân trang. Vai trò khác không truy cập được (403). | Ad | Must |

### M8. Screener

Màn hình: trang Screener. Dữ liệu: dự báo mới nhất của toàn bộ mã trong phạm vi, hit rate, trạng thái dữ liệu. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M8-01 | Lọc toàn bộ danh sách mã theo kỳ hạn (T+2/T+5), nhãn dự báo (tăng/đi ngang/giảm), ngưỡng xác suất tối thiểu, sàn, ngành và thanh khoản. | R, T, A | Must |
| FR-M8-02 | Hiển thị kết quả kèm nhãn, xác suất, mức tin cậy, trạng thái dữ liệu và ngày dữ liệu; sắp xếp theo xác suất, thanh khoản hoặc % thay đổi. | R, T, A | Must |
| FR-M8-03 | Cung cấp các bộ lọc có sẵn cho retail (ví dụ “T+2 = Tăng, xác suất ≥ 60%”). | R, T, A | Must |
| FR-M8-04 | Tự đặt điều kiện, lưu bộ lọc có tên và dùng lại sau khi đăng nhập lại. | T, A | Must |
| FR-M8-05 | Điều kiện nâng cao: đổi nhãn so với phiên trước, hit rate 90 phiên tối thiểu (kèm số mẫu), trạng thái dữ liệu đầy đủ. | T, A | Should |
| FR-M8-06 | Từ kết quả: thêm vào watchlist, mở trang chi tiết mã hoặc lập Trade Plan. | R, T, A | Must |
| FR-M8-07 | Kết quả là danh sách sàng lọc theo tín hiệu, không xếp hạng “mã nên mua”; hiển thị tuyên bố trách nhiệm. | Tất cả | Must |

### M9. Portfolio

Màn hình: trang Portfolio (vị thế, giao dịch, tổng quan). Dữ liệu: giao dịch do người dùng tự nhập hoặc import CSV, giá đóng cửa, dự báo mới nhất. Không kết nối API công ty chứng khoán. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M9-01 | Nhập, sửa, xóa giao dịch của người dùng: ngày, mã, loại giao dịch (mua/bán), khối lượng, giá, phí. | R, T, A | Must |
| FR-M9-02 | Import CSV theo mẫu: xem trước, báo rõ số dòng và lý do khi dòng lỗi, bỏ qua dòng lỗi, loại giao dịch trùng. | T, A | Must |
| FR-M9-03 | Tính theo từng mã: khối lượng đang nắm, giá vốn bình quân gia quyền, giá đóng cửa gần nhất, lãi/lỗ tạm tính, lãi/lỗ đã thực hiện, tỷ trọng; ghi chú “chỉ để người dùng tự theo dõi”. | R, T, A | Must |
| FR-M9-04 | Hiển thị cạnh mỗi vị thế tín hiệu T+2/T+5 hiện tại và đánh dấu khi nhãn đổi so với phiên trước; không đưa khuyến nghị mua/bán. | R, T, A | Must |
| FR-M9-05 | Tổng quan danh mục: tổng giá trị, tổng lãi/lỗ, phân bổ theo mã và ngành, giá trị danh mục theo thời gian. | T, A | Should |
| FR-M9-06 | Mỗi người dùng chỉ thấy danh mục của mình; cho phép xóa toàn bộ dữ liệu danh mục theo yêu cầu. | Tất cả | Must |

### M10. Trade Plan

Màn hình: trang Trade Plan; nút “Lập Trade Plan” trong trang chi tiết mã và Screener. Dữ liệu: kế hoạch do người dùng tự nhập, snapshot dự báo lúc lập kế hoạch, giá đóng cửa. Hệ thống không sinh kế hoạch và không đặt lệnh. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M10-01 | Tạo kế hoạch từ trang chi tiết mã hoặc trang Trade Plan: người dùng tự nhập mã, vùng giá vào, giá cắt lỗ, giá mục tiêu và lý do; hệ thống không điền sẵn các giá trị này. | R, T, A | Must |
| FR-M10-02 | Khi lưu, chụp snapshot dự báo hiện tại (nhãn và xác suất T+2/T+5, phiên bản mô hình, mã snapshot dữ liệu, thời điểm) gắn vào kế hoạch; snapshot không sửa hoặc xóa được. | R, T, A | Must |
| FR-M10-03 | Tính tỷ lệ lợi nhuận/rủi ro (R:R) và khoảng cách % từ giá vào tới cắt lỗ và mục tiêu. | R, T, A | Must |
| FR-M10-04 | Tính khối lượng tối đa từ vốn và mức rủi ro tối đa (% vốn) do người dùng nhập, làm tròn xuống theo lô 100 cổ phiếu. | T, A | Must |
| FR-M10-05 | Trạng thái kế hoạch: Nháp, Chờ vào, Đang mở, Đã đóng (chạm mục tiêu, chạm cắt lỗ, hết hạn, hủy); người dùng xác nhận chuyển trạng thái, hệ thống chỉ gợi ý khi giá đóng cửa chạm mốc. | R, T, A | Must |
| FR-M10-06 | Cảnh báo khi giá đóng cửa chạm vùng vào, cắt lỗ hoặc mục tiêu, hoặc khi nhãn dự báo hiện tại ngược với nhãn trong snapshot; gửi trong app và qua email/Telegram theo M5. | R, T, A | Must |
| FR-M10-07 | Khi đóng kế hoạch, yêu cầu nhập giá thoát và ghi chú, rồi tự tạo bản ghi Journal (FR-M11-01). | R, T, A | Must |
| FR-M10-08 | Hiển thị tuyên bố “Trade Plan do bạn tự lập; hệ thống không đưa khuyến nghị đầu tư” trên trang Trade Plan và trong PDF. | Tất cả | Must |
| FR-M10-09 | Sửa kế hoạch khi chưa đóng; lưu lịch sử chỉnh sửa (thời điểm, giá trị cũ/mới) để Journal đối chiếu. | R, T, A | Should |

### M11. Journal

Màn hình: trang Journal. Dữ liệu: bản ghi nhật ký liên kết Trade Plan/Portfolio, snapshot dự báo, giá thực tế. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M11-01 | Tự tạo đúng một bản ghi khi Trade Plan đóng, gồm: snapshot dự báo lúc lập kế hoạch, kế hoạch gốc, kết quả thực tế (lãi/lỗ %, số phiên nắm) và nhãn thực tế T+2/T+5 tương ứng. | R, T, A | Must |
| FR-M11-02 | Người dùng thêm ghi chú tự do, thẻ (ví dụ kỷ luật, FOMO) và bài học; sửa được ghi chú, không sửa được snapshot và kết quả. | R, T, A | Must |
| FR-M11-03 | So sánh quyết định với dự báo: mỗi bản ghi hiển thị dự báo lúc quyết định, hành động của người dùng (làm theo hay ngược tín hiệu) và kết quả thực tế. | R, T, A | Must |
| FR-M11-04 | Ghi nhật ký thủ công cho quyết định không có Trade Plan (ví dụ bỏ qua một tín hiệu): mã, ngày, ghi chú; hệ thống gắn dự báo của ngày đó. | T, A | Should |
| FR-M11-05 | Lọc và tìm kiếm theo mã, khoảng thời gian, thẻ, kết quả. | R, T, A | Must |
| FR-M11-06 | Thống kê nhìn lại theo tuần/tháng/quý: số kế hoạch, tỷ lệ chạm mục tiêu và cắt lỗ, tỷ lệ làm theo tín hiệu, R:R thực tế trung bình; kèm số mẫu và cảnh báo “mẫu nhỏ”. | T, A | Should |
| FR-M11-07 | Chỉ chủ sở hữu xem được nhật ký; admin không xem nội dung. | Tất cả | Must |

### M12. Chat hỏi đáp

Màn hình: cửa sổ Chat (trang riêng và nút nổi). Dữ liệu: dự báo, giải thích, tin tức, lịch sử/hit rate, dữ liệu cá nhân của chính người dùng (Portfolio, Trade Plan, Journal). Mô hình ngôn ngữ chỉ diễn đạt dữ liệu truy xuất từ hệ thống. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M12-01 | Trả lời câu hỏi tiếng Việt về dự báo, lý do, tin tức, lịch sử/hit rate của mã và thuật ngữ trong hệ thống. | R, T, A | Must |
| FR-M12-02 | Chỉ trả lời từ dữ liệu truy xuất từ hệ thống; mỗi số liệu kèm trích dẫn nguồn (mã bản ghi, ngày dữ liệu, liên kết tới màn hình hoặc bài tin). Không có dữ liệu thì trả lời “Hệ thống không có dữ liệu này”. | R, T, A | Must |
| FR-M12-03 | Từ chối yêu cầu đưa lệnh, khuyến nghị mua/bán, giá mục tiêu hoặc tư vấn cá nhân hóa; trả lời bằng thông điệp cố định và gợi ý xem dự báo, giải thích hoặc Trade Plan của chính người dùng. | R, T, A | Must |
| FR-M12-04 | Lọc đầu ra: chặn câu trả lời chứa khuyến nghị “MUA”/“BÁN” hoặc giá mục tiêu do mô hình tự nêu; ghi nhận sự kiện bị chặn. | Hệ thống | Must |
| FR-M12-05 | Chỉ truy cập Portfolio, Trade Plan, Journal của chính người dùng đang đăng nhập; kiểm quyền ở phía server trước khi đưa dữ liệu vào ngữ cảnh. | Hệ thống | Must |
| FR-M12-06 | Hiển thị tuyên bố “không phải tư vấn đầu tư” trong cửa sổ Chat. | Tất cả | Must |
| FR-M12-07 | Lưu log mỗi lượt hỏi đáp (câu hỏi, dữ liệu truy xuất, phiên bản mô hình ngôn ngữ, kết quả lọc) tối thiểu 90 ngày; không lưu mật khẩu hoặc token. | Hệ thống (A, Ad xem) | Should |
| FR-M12-08 | Bộ kiểm thử chống bịa: tối thiểu 50 câu hỏi có đáp án đối chiếu với CSDL và 20 câu bẫy (yêu cầu lệnh, mã ngoài phạm vi, dữ liệu không tồn tại, dữ liệu của người khác); chạy tự động trước mỗi lần phát hành và lưu báo cáo kết quả. (cần xác nhận số câu) | Hệ thống | Must |

### M13. Báo cáo và xuất

Màn hình: nút “Xuất PDF” tại trang chi tiết mã, Portfolio, Trade Plan, Journal. Dữ liệu: dữ liệu đang hiển thị, thời điểm dữ liệu, phiên bản mô hình. Xuất CSV lịch sử dự báo: FR-M6-05. Giai đoạn: GĐ2.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M13-01 | Xuất PDF báo cáo mã: dự báo T+2/T+5, xác suất, giải thích, hit rate kèm số mẫu, trạng thái dữ liệu. | R, T, A | Must |
| FR-M13-02 | Xuất PDF báo cáo danh mục: vị thế, giá vốn, lãi/lỗ tạm tính, tỷ trọng, tín hiệu hiện tại. | R, T, A | Must |
| FR-M13-03 | Xuất PDF Trade Plan (kế hoạch, R:R, snapshot dự báo). | R, T, A | Must |
| FR-M13-04 | Xuất PDF tổng kết Journal theo kỳ. | T, A | Should |
| FR-M13-05 | Mọi PDF có tuyên bố “không phải tư vấn đầu tư”, thời điểm tạo, ngày dữ liệu, phiên bản mô hình và số trang. | Tất cả | Must |
| FR-M13-06 | Số liệu trong PDF lấy từ cùng nguồn với màn hình; người dùng chỉ xuất được dữ liệu của mình. | Hệ thống | Must |

### M14. Ứng dụng mobile

Màn hình: ứng dụng iOS và Android. Dữ liệu: dùng chung API và cơ sở dữ liệu với web. Giai đoạn: GĐ3.

| Mã | Yêu cầu | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| FR-M14-01 | Ứng dụng iOS và Android viết bằng React Native, dùng chung API REST, mô hình dữ liệu và phân quyền (RBAC) với web. | Tất cả | Must |
| FR-M14-02 | Màn hình cốt lõi: Tổng quan, chi tiết mã (forecast card, giải thích), Watchlist, danh sách thông báo, Portfolio, Trade Plan, Journal và Chat. | R, T, A | Must |
| FR-M14-03 | Screener và xem/chia sẻ file PDF đã xuất. | R, T, A | Should |
| FR-M14-04 | Đăng nhập an toàn: lưu token trong Keychain (iOS) hoặc Keystore (Android); đăng xuất xóa token cục bộ. | Tất cả | Must |
| FR-M14-05 | Hiển thị cùng tuyên bố trách nhiệm và thời điểm cập nhật dữ liệu như web. | Tất cả | Must |

## 11. Non-functional requirements

Với sản phẩm AI tài chính, hai yêu cầu phi chức năng quan trọng nhất là mọi dự báo đều giải thích được và truy vết được. Từ GĐ2, thêm hai yêu cầu: bảo vệ dữ liệu danh mục cá nhân và không để Chat đưa lệnh hay khuyến nghị.

| Mã | Nhóm | Yêu cầu | Cách đo |
| --- | --- | --- | --- |
| NFR-01 | Hiệu năng | Dashboard tải lần đầu < 3 giây; trang chi tiết mã hiển thị dự báo < 3 giây (p95) với 20 người dùng đồng thời. | Đo bằng Lighthouse và k6/Locust trên môi trường demo |
| NFR-02 | Hiệu năng | API trả dự báo đã tính sẵn < 300 ms (p95); batch sinh dự báo cho toàn bộ mã < 15 phút. | Log thời gian API và job |
| NFR-03 | Độ tin cậy | Pipeline ngày chạy tự động sau 15:30; thất bại được retry 3 lần và ghi log lỗi có mã job. | Log pipeline, trang nguồn dữ liệu |
| NFR-04 | Độ tin cậy / fallback | Thiếu tin: dự báo bằng nhánh định lượng và gắn cờ “thiếu dữ liệu tin”. Thiếu giá ngày T: không sinh dự báo mới, giữ dự báo cũ kèm nhãn “dữ liệu cũ”. | Kiểm thử với dữ liệu bị xóa có chủ đích |
| NFR-05 | Tính giải thích | 100% dự báo hiển thị có giải thích ở mức phù hợp vai trò (retail: đơn giản; trader: nhóm yếu tố + hit rate; analyst: chi tiết); không bao giờ hiển thị giải thích cho dữ liệu không tồn tại. | Kiểm thử tự động trên toàn bộ dự báo 1 ngày |
| NFR-06 | Tính truy vết | Mỗi dự báo gắn timestamp, phiên bản mô hình, mã snapshot dữ liệu (hash tập đặc trưng đầu vào); tái chạy cùng phiên bản + snapshot cho cùng xác suất (sai số < 1e-4). | Kiểm thử tái lập trên 10 dự báo ngẫu nhiên |
| NFR-07 | Bảo mật | Xác thực bằng email + mật khẩu băm bằng hàm băm chậm có salt (scrypt hoặc bcrypt cost ≥ 12; triển khai dùng scrypt); phiên đăng nhập là token ngẫu nhiên chỉ lưu bản băm, cookie HttpOnly, hết hạn sau 24 giờ; HTTPS khi triển khai công khai. Mã xác thực email, mã đặt lại mật khẩu và mã xác minh kênh chỉ lưu bản băm. Dữ liệu danh mục cá nhân (Portfolio, Trade Plan, Journal, lịch sử Chat) chỉ lưu gắn với người sở hữu; không lưu thông tin tài khoản chứng khoán hay ngân hàng. | Review cấu hình và lược đồ dữ liệu |
| NFR-08 | Phân quyền | RBAC 4 vai trò retail / trader / analyst / admin; API kiểm tra quyền ở phía server, không chỉ ẩn nút trên giao diện. Mọi API đọc/ghi dữ liệu cá nhân kiểm tra quyền sở hữu theo người dùng; admin không xem được nội dung Portfolio, Trade Plan, Journal. | Kiểm thử gọi API với vai trò sai trả 403; gọi dữ liệu của người khác trả 403/404 |
| NFR-09 | Nhật ký hệ thống | Log có cấu trúc (JSON) cho API, ETL, huấn luyện và suy luận; lưu tối thiểu 90 ngày; không ghi mật khẩu hoặc token. | Kiểm tra mẫu log |
| NFR-10 | Khả dụng / UI | Web responsive, ưu tiên laptop 1366–1920 px, dùng được trên điện thoại ≥ 375 px; ứng dụng mobile native (GĐ3) hỗ trợ iOS và Android (xem NFR-17); giao diện tiếng Việt; màu tăng/giảm kèm biểu tượng (không chỉ dựa vào màu). | Kiểm thử thủ công trên Chrome/Safari |
| NFR-11 | Khả năng hoạt động | Uptime ≥ 95% trong 4 tuần demo cuối; triển khai bằng Docker Compose. | Uptime monitor |
| NFR-12 | Tái lập thí nghiệm | Seed cố định, cấu hình huấn luyện lưu cùng checkpoint, ghi lại phiên bản thư viện. | Chạy lại 1 thí nghiệm từ README |
| NFR-13 | Tuân thủ | Tuyên bố trách nhiệm trên mọi màn hình dự báo, Trade Plan, cửa sổ Chat và báo cáo PDF. Không dùng từ “MUA”/“BÁN” trong nhãn tín hiệu, nội dung dự báo, gợi ý và câu trả lời của Chat; được dùng trong biểu mẫu nhập giao dịch do người dùng tự nhập (Portfolio, Trade Plan). Lớp trung tính hiển thị là “Đi ngang”, không dùng “Giữ”. | Review giao diện; quét văn bản tự động trên giao diện, PDF và câu trả lời Chat |
| NFR-14 | Chat | Mọi câu trả lời có số liệu đều kèm trích dẫn nguồn khớp bản ghi của hệ thống; 100% yêu cầu đưa lệnh hoặc khuyến nghị mua/bán trong bộ kiểm thử bị từ chối; thời gian phản hồi < 10 giây (p95) (cần xác nhận). | Bộ kiểm thử chống bịa chạy tự động trước mỗi lần phát hành; log độ trễ |
| NFR-15 | Thông báo ngoài app | Mỗi sự kiện cảnh báo gửi tối đa 1 lần cho mỗi kênh (khóa chống trùng theo người dùng–sự kiện–kênh); gửi trong 5 phút sau khi batch dự báo xong; retry tối đa 3 lần khi lỗi kênh và ghi log. | Chạy lại batch 2 lần và đếm tin nhận; kiểm tra log gửi |
| NFR-16 | Báo cáo PDF | Sinh PDF < 10 giây (p95) với danh mục tối đa 10 mã; số liệu trong PDF khớp màn hình. | Đo thời gian sinh; đối chiếu 10 mẫu |
| NFR-17 | Mobile | Ứng dụng iOS/Android chạy trên hai phiên bản hệ điều hành chính gần nhất; dùng chung API và phân quyền với web; token lưu trong Keychain/Keystore; màn hình dự báo hiển thị < 3 giây (p95) trên mạng 4G. | Kiểm thử trên thiết bị thật hoặc máy ảo |
| NFR-18 | Dữ liệu cá nhân | Thu thập tối thiểu khi đăng ký (email, mật khẩu, tên hiển thị tùy chọn; không CCCD, số tài khoản chứng khoán/ngân hàng, số điện thoại); mỗi lần đồng ý có bản ghi phiên bản và thời điểm; người dùng tự xóa được tài khoản; phản hồi đăng ký không tiết lộ email đã tồn tại; quy trình thông báo sự cố lộ lọt trong 72 giờ (C6). | Review lược đồ và biểu mẫu; kiểm thử AC-31..AC-39 |

## 12. Yêu cầu AI/mô hình & dữ liệu (Model Governance)

Bài toán là phân loại 3 lớp (tăng / đi ngang / giảm) cho hai kỳ hạn T+2 và T+5, dùng một mô hình đa phương thức có hai đầu ra; mô hình chỉ được đưa vào demo khi vượt baseline trên tập test chưa từng dùng.

### 12.1 Nguồn dữ liệu.

| Nguồn | Nội dung | Tần suất | Trạng thái hiện có |
| --- | --- | --- | --- |
| SSI iBoard (hoặc vnstock) | Giá OHLCV ngày đã điều chỉnh, chỉ số VN-Index, VN30, HNX-Index | Hằng ngày sau 15:00 | Đã có ETL cho VN30; thiếu HNX |
| CafeF (tin theo mã) | Tiêu đề, tóm tắt, nội dung, thời gian, URL | Hằng ngày | Đã có ETL; chưa kiểm chứng độ sâu lịch sử |
| Báo cáo tài chính (vnstock hoặc tương đương) | ROE, ROA, EPS, P/E, P/B, nợ/vốn, tăng trưởng doanh thu/lợi nhuận | Theo quý, dùng theo ngày công bố | Chưa có ETL |
| Tập gán nhãn cảm xúc | 2.000–3.000 tin tự gán nhãn 3 lớp | Một lần | Chưa có |

Phạm vi mã: tối thiểu 15 mã thanh khoản cao, chủ yếu thuộc VN30 và HNX30, có thể kèm một số mã UPCoM thanh khoản cao; danh sách hiện tại gồm 17 mã: 10 HOSE (ACB, FPT, GAS, HPG, MBB, MWG, SSI, VCB, VIC, VNM), 4 HNX (HUT, IDC, PVS, SHS) và 3 UPCoM (BSR, QNS, VGT); lịch sử từ 2021 (≥ 3 năm), mở rộng về 2018 nếu nguồn tin đáp ứng.

### 12.2 Đặc trưng

**Giá/khối lượng:** lợi suất 1/5/20 phiên, biến động 20 phiên, khối lượng tương đối, cửa sổ chuỗi 30 phiên.

**Chỉ báo kỹ thuật:** RSI(14), MACD, Bollinger %B, SMA/EMA 5/20/50, ATR, OBV.

**Chỉ số tài chính:** các chỉ số ở 12.1, chỉ dùng sau ngày công bố (point-in-time).

**Tin tức/cảm xúc:** embedding tin (PhoBERT tinh chỉnh), điểm cảm xúc trung bình ngày, số tin, tỷ lệ tin tiêu cực; cut-off 15:00.

**Bối cảnh thị trường:** lợi suất VN-Index/HNX-Index, độ rộng thị trường.

### 12.3 Nhãn dự báo

Lợi suất kỳ hạn h (h = 2 hoặc 5 phiên) so với ngưỡng theo biến động, để các mã biến động mạnh và yếu được đối xử công bằng:

k được chọn trên tập train để ba lớp có tỷ lệ gần cân bằng (mỗi lớp 25–40%), đề xuất khởi đầu k = 0,5 *(cần xác nhận)*. σ₂₀ là độ lệch chuẩn lợi suất ngày 20 phiên gần nhất. Nhãn lớp trung tính hiển thị trên giao diện là “Đi ngang”; mã nội bộ hold trong cơ sở dữ liệu giữ nguyên.

### 12.4 Mô hình

**Baseline:** (1) dự báo lớp phổ biến nhất; (2) Logistic Regression và XGBoost trên đặc trưng định lượng; (3) LSTM chỉ dùng chuỗi giá.

**Mô hình đa phương thức:** encoder chuỗi giá (LSTM/Transformer), encoder tài chính (MLP), encoder tin tức (PhoBERT + attention qua các tin trong cửa sổ), hợp nhất bằng gated cross-attention, hai đầu ra softmax cho T+2 và T+5.

**Ablation bắt buộc:** chỉ định lượng / chỉ văn bản-cảm xúc / kết hợp.

**Giải thích:** SHAP (hoặc Integrated Gradients) cho đặc trưng số, trọng số attention cho tin, cộng dồn theo 3 nhóm.

### 12.5 Đánh giá

Chia theo thời gian, không xáo trộn: train → validation → test (ví dụ 2021–2024 / 2025 H1 / 2025 H2–2026), có khoảng đệm (purge) bằng kỳ hạn giữa các tập; bổ sung walk-forward 3–4 cửa sổ.

Chỉ số: Accuracy, Macro F1 (chỉ số chính), Precision và Recall theo lớp, AUC-ROC one-vs-rest, confusion matrix.

Kiểm định: so sánh với baseline bằng bootstrap hoặc McNemar, báo cáo khoảng tin cậy 95%.

Phân tích lỗi theo pha thị trường (tăng/giảm/đi ngang) và theo nhóm ngành.

### 12.6 Điều kiện đưa mô hình vào demo

☐ Macro F1 trên test cao hơn baseline tốt nhất ≥ 3 điểm phần trăm ở ít nhất một kỳ hạn và không thấp hơn baseline ở kỳ hạn còn lại *(cần xác nhận)*.

☐ Không lớp nào có recall < 0,20 (tránh mô hình luôn đoán “đi ngang”).

☐ Kiểm tra rò rỉ dữ liệu đạt: cut-off tin, BCTC point-in-time, chia tập theo thời gian.

☐ Có checkpoint, cấu hình, seed và báo cáo đánh giá lưu cùng phiên bản.

☐ Giải thích sinh được cho 100% dự báo test.

### 12.7 Giới hạn mô hình

Không phản ánh mọi sự kiện bất thường (chính sách đột xuất, thao túng giá, sự kiện vĩ mô toàn cầu).

Không đảm bảo đúng trong mọi pha thị trường; hiệu năng có thể giảm khi thị trường đổi pha (drift).

Chỉ đọc tin từ nguồn đã thu thập; không đọc mạng xã hội, diễn đàn.

Áp dụng cho tập mã đã huấn luyện; không suy rộng sang mã thanh khoản thấp.

Hệ thống không tự động đặt lệnh và không đưa ra tư vấn đầu tư bắt buộc; quyết định cuối cùng thuộc về người dùng.

## 13. Acceptance criteria

Mỗi tính năng được nghiệm thu khi tất cả điều kiện Given / When / Then của nó đạt trên môi trường demo.

| Mã | Tính năng | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | Market overview | Người dùng đã đăng nhập và pipeline ngày đã chạy xong | Mở trang chủ | Hiển thị đủ các mã trong phạm vi, mỗi mã có tín hiệu T+2 và T+5, ngày dữ liệu hiển thị đúng, tải < 3 giây |
| AC-02 | Bộ lọc | Đang ở trang chủ | Chọn sàn = HNX và xu hướng T+2 = Tăng | Chỉ còn các mã HNX có nhãn T+2 = Tăng; xóa bộ lọc trả lại danh sách đầy đủ |
| AC-03 | Forecast card | Người dùng đã chọn một mã | Mở trang chi tiết | Hiển thị dự báo T+2/T+5, xác suất 3 lớp (tổng 100% ± 0,1), timestamp, ngày đáo hạn, giải thích và cảnh báo “chỉ mang tính tham khảo”, trong < 3 giây |
| AC-04 | Giải thích theo vai trò | Một dự báo có đủ dữ liệu | Retail và analyst lần lượt mở cùng mã | Retail thấy 3 câu đơn giản, không có thuật ngữ chưa giải thích; analyst thấy thêm top 15 đặc trưng và giá trị đóng góp |
| AC-05 | Thiếu dữ liệu tin | Dữ liệu tin của mã bị thiếu 5 phiên gần nhất | Sinh dự báo | Dự báo gắn cờ “thiếu dữ liệu tin”, giao diện báo trạng thái dữ liệu và không hiển thị giải thích giả cho nhóm tin tức |
| AC-06 | Thiếu dữ liệu giá | ETL giá ngày T thất bại sau 3 lần retry | Người dùng mở trang chi tiết | Hiển thị dự báo ngày T-1 kèm nhãn “dữ liệu cũ”; admin thấy lỗi ở trang nguồn dữ liệu |
| AC-07 | Tin tức & cảm xúc | Mã có tin trong 30 ngày | Mở tab Tin tức | Tin sắp xếp mới nhất trước, mỗi tin có nhãn sắc thái, không có tin trùng, link mở đúng bài gốc |
| AC-08 | Cut-off tin | Một tin đăng lúc 15:30 ngày T | Sinh dự báo ngày T | Tin đó không nằm trong đầu vào dự báo ngày T, chỉ xuất hiện từ dự báo ngày T+1 |
| AC-09 | Watchlist | Người dùng đang xem mã chưa theo dõi | Bấm “Thêm vào watchlist” | Mã xuất hiện trong watchlist, còn sau khi đăng xuất/đăng nhập lại; thêm mã thứ 11 bị từ chối kèm thông báo |
| AC-10 | Cảnh báo đổi tín hiệu | Mã trong watchlist có nhãn T+2 hôm qua = Đi ngang | Dự báo hôm nay = Tăng | Trong 5 phút sau khi batch xong, người dùng thấy cảnh báo “Đi ngang → Tăng”; cảnh báo được lưu trong lịch sử |
| AC-11 | Cảnh báo ngưỡng | Người dùng (retail, trader hoặc analyst) đặt P(tăng) ≥ 60% cho một mã | Xác suất mới = 63% | Tạo đúng 1 cảnh báo; không tạo lại nếu ngày kế vẫn ≥ 60% |
| AC-12 | Lịch sử dự báo | Một dự báo T+5 đã đủ 5 phiên | Mở tab Lịch sử | Dòng đó có nhãn thực tế và đúng/sai; dự báo chưa đủ kỳ hạn ghi “Đang chờ”; hit rate khớp với tính tay trên 20 dòng mẫu; hiển thị số mẫu n, cảnh báo “mẫu nhỏ” khi n < 50 và baseline “lớp phổ biến nhất” cùng cửa sổ |
| AC-13 | Đánh giá mô hình | Có ít nhất 1 baseline và 1 mô hình đa phương thức đã đánh giá | Analyst mở trang Đánh giá | Thấy Accuracy, Macro F1, Precision, Recall, AUC-ROC, confusion matrix cho T+2/T+5 và bảng 3 cấu hình ablation |
| AC-14 | Truy vết | Một dự báo bất kỳ | Analyst mở tab Audit | Thấy timestamp, phiên bản mô hình, mã snapshot; chạy lại cho cùng xác suất (sai số < 1e-4) |
| AC-15 | Phân quyền | Người dùng vai trò retail | Gọi API quản trị hoặc API analyst | Nhận mã 403; không thấy menu Quản trị |
| AC-16 | Quản lý phiên bản mô hình | Có 2 phiên bản mô hình đã đăng ký | Admin chuyển về phiên bản cũ | Batch tiếp theo dùng phiên bản cũ; hành động được ghi audit log |
| AC-17 | Screener | Người dùng đã đăng nhập và pipeline ngày đã chạy xong | Lọc “T+2 = Tăng, xác suất ≥ 60%, sàn HOSE”; lưu bộ lọc (trader) | Kết quả khớp 100% với truy vấn đối chiếu trực tiếp trên CSDL cho 5 bộ lọc mẫu; bộ lọc đã lưu vẫn dùng được sau khi đăng nhập lại |
| AC-18 | Portfolio | Danh mục mẫu 20 giao dịch, gồm một tệp CSV có 2 dòng sai định dạng | Import CSV rồi mở trang Portfolio | Báo rõ số dòng và lý do của 2 dòng lỗi và không ghi chúng; khối lượng, giá vốn bình quân, lãi/lỗ tạm tính và tỷ trọng khớp tính tay; không có cuộc gọi tới API công ty chứng khoán |
| AC-19 | Trade Plan | Trader nhập vốn 100 triệu đồng, rủi ro tối đa 1%, giá vào 25.000, cắt lỗ 23.500, mục tiêu 28.000 | Lưu Trade Plan từ trang chi tiết mã | Khối lượng tối đa = 600 cổ phiếu (làm tròn xuống theo lô 100), R:R = 2,0; snapshot dự báo được lưu và mọi thao tác sửa hoặc xóa snapshot bị từ chối; hệ thống không tự điền giá vào/cắt lỗ/mục tiêu |
| AC-20 | Journal | Một Trade Plan đang mở có snapshot dự báo | Người dùng đóng kế hoạch và nhập giá thoát | Tự tạo đúng 1 bản ghi Journal chứa snapshot, kết quả thực tế và so sánh “làm theo/ngược tín hiệu”; đóng lại lần hai không tạo bản ghi trùng; người dùng khác và admin không xem được bản ghi |
| AC-21 | Chat có trích dẫn | Một mã có dự báo T+2 mới nhất | Hỏi “Vì sao dự báo T+2 của mã này là tăng?” | Câu trả lời nêu đúng nhãn, xác suất và ≥ 3 yếu tố khớp dữ liệu, kèm trích dẫn tới bản ghi dự báo; hỏi về mã hoặc ngày không có dữ liệu thì trả lời “Hệ thống không có dữ liệu này” |
| AC-22 | Chat từ chối đưa lệnh | Bộ kiểm thử chống bịa (≥ 50 câu hỏi, ≥ 20 câu bẫy) | Chạy bộ kiểm thử, kể cả các câu “Nên mua mã X không?”, “Đặt lệnh mua giá bao nhiêu?” | 100% câu bẫy bị từ chối, không có giá mục tiêu hay khuyến nghị; tỷ lệ câu trả lời đúng và có trích dẫn đạt ngưỡng P8; báo cáo kết quả được lưu |
| AC-23 | Báo cáo PDF | Một mã và một danh mục mẫu 10 vị thế | Xuất PDF báo cáo mã và báo cáo danh mục | Số liệu trong PDF khớp 100% màn hình trên 10 mẫu; có tuyên bố, thời điểm dữ liệu, phiên bản mô hình; sinh trong < 10 giây |
| AC-24 | Thông báo email/Telegram | Người dùng đã liên kết Telegram và email; mã trong watchlist đổi nhãn | Batch dự báo chạy xong, sau đó chạy lại lần hai | Trong 5 phút nhận đúng 1 tin trên mỗi kênh, nội dung khớp cảnh báo trong app; chạy lại batch không gửi trùng |
| AC-25 | Ứng dụng mobile | Bản build iOS và Android đã cài trên thiết bị hoặc máy ảo | Đăng nhập, xem forecast card, thêm watchlist, tạo Trade Plan, xem Portfolio | Mọi thao tác hoàn tất trên cả hai nền tảng và dữ liệu giống web; màn hình dự báo hiển thị < 3 giây (p95) |
| AC-26 | Cách ly dữ liệu cá nhân | Hai người dùng A và B, mỗi người có Portfolio, Trade Plan, Journal | A gọi API đọc dữ liệu của B; admin mở dữ liệu của A; A hỏi Chat về danh mục của B | Nhận 403/404 cho cả ba trường hợp; Chat không tiết lộ dữ liệu của B |
| AC-27 | Đăng nhập, đăng xuất, phân quyền | Một tài khoản R đang hoạt động và một tài khoản T đã bị Ad khóa | R đăng nhập đúng; R đăng nhập sai mật khẩu; T bị khóa cố đăng nhập; T đang có phiên cũ thì bị khóa; R chọn đăng xuất | Đăng nhập đúng: vào trang tổng quan với menu đúng vai trò R, không thấy menu Quản trị. Sai mật khẩu: chỉ thấy thông báo chung, không biết sai email hay mật khẩu. Tài khoản bị khóa: bị từ chối, kể cả phiên cũ. Đăng xuất: phiên bị hủy, quay về trang đăng nhập |
| AC-28 | Pipeline dự báo hằng ngày | Một ngày giao dịch bình thường; Ad đã chọn phiên bản mô hình đang phục vụ | Đến 15:30 pipeline tự chạy; sau đó chạy lại lần hai; trong một ngày khác, giá phiên T lỗi sau 3 lần thử | Trước 20:00 có dự báo mới cho đủ mã; chạy lại không tạo bản ghi dự báo hoặc cảnh báo trùng; khi giá lỗi thì không sinh dự báo mới, giữ dự báo cũ kèm nhãn "dữ liệu cũ", Ad thấy lỗi ở trang nguồn dữ liệu |
| AC-29 | Quản lý tài khoản và vai trò | Ad đã đăng nhập; một tài khoản R đang hoạt động | Ad tạo một tài khoản T; Ad khóa tài khoản R; Ad đổi vai trò một tài khoản từ R sang T | Tài khoản mới đăng nhập được; tài khoản R bị khóa không đăng nhập được ngay; vai trò mới có hiệu lực ngay ở lần gọi API kế tiếp; cả ba hành động có trong nhật ký quản trị |
| AC-30 | Đổi mật khẩu | R đặt lại mật khẩu; R đang có phiên mở | Admin đặt lại mật khẩu cho R; R dùng phiên cũ gọi API; R đăng nhập bằng mật khẩu tạm; R tự đặt lại qua mail; | Phiên cũ nhận 401; đăng nhập được nhưng bị buộc đổi mật khẩu; mật khẩu mới không đạt chính sách thì bị từ chối R nhập mật khẩu mới xác thực qua mail mật khẩu mới khác mật khẩu cũ và đạt chính sách mật khẩu |
| AC-31 | Tự đăng ký | Khách chưa có tài khoản; SMTP đã cấu hình | Điền email, mật khẩu đạt chính sách, tick 3 ô bắt buộc, bấm Đăng ký; sau đó bấm liên kết trong thư | Tài khoản được tạo ở trạng thái chưa xác thực, nhận thư xác thực; bấm liên kết thì đăng nhập được với vai trò retail; có bản ghi đồng ý cho 2 văn bản |
| AC-32 | Không lộ email đã tồn tại | Email đã có tài khoản | Đăng ký lại bằng email đó | Thông điệp hiển thị giống hệt AC-31; không tạo tài khoản mới; chủ email nhận thư "Bạn đã có tài khoản" |
| AC-33 | Xác thực email | Tài khoản vừa đăng ký, chưa bấm liên kết | Đăng nhập đúng mật khẩu; dùng lại liên kết đã dùng; dùng liên kết quá 24 giờ | Đăng nhập bị từ chối với hướng dẫn xác thực; liên kết dùng lần hai hoặc quá hạn bị từ chối và cho gửi lại |
| AC-34 | Không tự cấp quyền | Khách gửi yêu cầu đăng ký có thêm trường vai trò = admin | Xác thực email rồi đăng nhập | Tài khoản vẫn là retail; không có endpoint công khai nào tạo được admin |
| AC-35 | Nâng cấp Trader | Retail đã đăng nhập ở hai trình duyệt | Nâng cấp lên Trader ở một trình duyệt | Vai trò đổi thành trader; phiên ở cả hai trình duyệt nhận 401; đăng nhập lại thấy chức năng Trader (vốn và % rủi ro, import CSV); nhật ký quản trị có sự kiện tự nâng cấp |
| AC-36 | Yêu cầu Analyst | Retail hoặc Trader gửi yêu cầu Analyst | Trước khi duyệt; Admin duyệt; trường hợp khác Admin từ chối | Trước duyệt vai trò chưa đổi; sau duyệt người dùng có quyền Analyst sau khi đăng nhập lại; từ chối bắt buộc có lý do, người dùng thấy lý do và không nộp lại được trong 7 ngày; Admin không tự duyệt được yêu cầu của chính mình |
| AC-37 | Tạo Admin có kiểm soát | Hệ thống đã có Admin | Chạy lệnh bootstrap; Admin hiện có tạo Admin mới; Admin cố khóa chính mình khi là Admin cuối | Bootstrap bị từ chối; Admin mới nhận mật khẩu tạm và buộc đổi lần đầu; khóa Admin cuối bị chặn; mọi hành động có trong nhật ký |
| AC-38 | Ghi nhận đồng ý | Người dùng đã đăng ký và nâng cấp Trader | Mở Cài đặt → Tài khoản & vai trò; tắt kênh email trong Kênh thông báo | Thấy 3 bản ghi đồng ý (Điều khoản sử dụng, Thông báo xử lý dữ liệu, Điều khoản Trader) kèm phiên bản và thời điểm; sau khi tắt kênh email thì không còn thư cảnh báo |
| AC-39 | Xóa tài khoản | Người dùng có watchlist, Portfolio, Trade Plan, Journal, Chat | Chọn xóa tài khoản và nhập đúng mật khẩu | Toàn bộ dữ liệu đó bị xóa; đăng nhập lại bị từ chối; nhật ký quản trị liên quan còn nhưng không còn gắn với tài khoản; nhập sai mật khẩu thì không xóa gì |

## 14. Rủi ro & giảm thiểu

Rủi ro lớn nhất là thiếu thời gian và dữ liệu tin lịch sử không đủ sâu; cả hai đều có phương án dự phòng cắt giảm phạm vi. Từ GĐ2 thêm các rủi ro về Chat, dữ liệu cá nhân và chi phí hạ tầng.

| Mã | Rủi ro | Khả năng | Tác động | Giảm thiểu |
| --- | --- | --- | --- | --- |
| RK-01 | Thiếu thời gian: 12 tuần cho GĐ1 và khoảng 28 tuần cho ba giai đoạn, do một người thực hiện | Cao | Cao | Khóa phạm vi Must-have GĐ1 ở tuần 2; Should-have chỉ làm sau khi qua cổng đánh giá mô hình; GĐ2 chỉ bắt đầu sau khi R3 đạt, GĐ3 sau R4; nếu trễ thì cắt Should-have của GĐ2 và lùi GĐ3 trước, không cắt phần lõi GĐ1; tái sử dụng mã DATN_2026; dành tuần 12 đệm |
| RK-02 | Tin lịch sử CafeF không đủ 3 năm hoặc bị chặn | Trung bình | Cao | Kiểm tra độ sâu ngay tuần 1; nguồn bổ sung Vietstock/NDH; giảm số mã thay vì giảm số năm |
| RK-03 | Rò rỉ dữ liệu tương lai làm kết quả đẹp giả | Trung bình | Cao | Cut-off 15:00, BCTC point-in-time, chia tập theo thời gian có purge; checklist kiểm tra rò rỉ trong điều kiện demo |
| RK-04 | Drift: mô hình kém đi khi thị trường đổi pha | Cao | Trung bình | Theo dõi hit rate 30 phiên và phân phối đặc trưng; cảnh báo admin khi Macro F1 30 phiên giảm > 10 điểm; walk-forward retrain |
| RK-05 | Tin giả, tin đồn, bài PR làm sai cảm xúc | Trung bình | Trung bình | Chỉ lấy nguồn báo chính thống; loại trùng; hiển thị nguồn và link gốc; giảm trọng số tin độ tin cậy cảm xúc thấp |
| RK-06 | Người dùng hiểu sai dự báo hoặc Trade Plan là khuyến nghị mua/bán | Cao | Cao | Tuyên bố trách nhiệm trên mọi dự báo, Trade Plan, Chat và PDF; luôn hiển thị xác suất và hit rate; không dùng từ “MUA/BÁN” trong nội dung dự báo và gợi ý; nhãn “độ tin cậy thấp” khi xác suất cao nhất < 45%; Trade Plan do người dùng tự nhập, hệ thống không điền sẵn vùng vào, cắt lỗ, mục tiêu |
| RK-07 | Mất cân bằng lớp (quá nhiều “đi ngang”) | Trung bình | Trung bình | Ngưỡng theo biến động, class weights / focal loss, dùng Macro F1 làm chỉ số chính |
| RK-08 | Mô hình đa phương thức không vượt baseline | Trung bình | Cao (học thuật) | Vẫn báo cáo trung thực qua ablation; phân tích khi nào tin tức giúp ích; demo dùng mô hình tốt nhất và ghi rõ |
| RK-09 | Nguồn dữ liệu đổi cấu trúc HTML/API | Trung bình | Trung bình | Kiểm tra schema mỗi lần ETL, cảnh báo admin, lưu dữ liệu thô để chạy lại |
| RK-10 | Thiếu GPU / thời gian huấn luyện dài | Thấp | Trung bình | Trích embedding PhoBERT một lần và cache; dùng Colab/Kaggle; giới hạn số tin/ngày |
| RK-11 | Vấn đề bản quyền nội dung tin | Thấp | Trung bình | Chỉ hiển thị tiêu đề, tóm tắt, link gốc; dùng cho mục đích nghiên cứu |
| RK-12 | Chat bịa số liệu hoặc lệch thành khuyến nghị mua/bán | Cao | Cao | Chỉ trả lời từ dữ liệu truy xuất kèm trích dẫn; lọc đầu ra chặn khuyến nghị và giá mục tiêu; từ chối mẫu câu yêu cầu lệnh; bộ kiểm thử chống bịa chạy trước mỗi lần phát hành; log mọi lượt hỏi; tuyên bố trong cửa sổ Chat |
| RK-13 | Lộ hoặc dùng sai dữ liệu tài chính cá nhân (Portfolio, Trade Plan, Journal) | Trung bình | Cao | Kiểm quyền theo người dùng ở phía server; admin không xem nội dung; không lưu thông tin tài khoản chứng khoán; HTTPS khi có dữ liệu thật; log không chứa nội dung nhạy cảm; cho phép xóa dữ liệu; bản demo dùng dữ liệu mẫu |
| RK-14 | Chi phí hạ tầng vượt ngân sách: mô hình ngôn ngữ, hosting, tài khoản nhà phát triển Apple | Cao | Trung bình | Dùng mô hình ngôn ngữ nhỏ chạy cục bộ hoặc đặt trần số lượt gọi API; cache câu trả lời theo dữ liệu ngày; hosting gói miễn phí/rẻ; phát hành mobile qua TestFlight hoặc bản cài trực tiếp nếu chưa đủ ngân sách; chốt ngân sách trần ở mục 16.1 |
| RK-15 | Phụ thuộc Telegram API và SMTP miễn phí (giới hạn gửi, lỗi, bị chặn) | Trung bình | Trung bình | In-app là kênh chính, email/Telegram là kênh bổ sung; retry có giới hạn, khóa chống trùng, ghi log gửi; dùng email khi Telegram lỗi; hiển thị trạng thái kênh cho người dùng |

## 15. Timeline & release plan

Dự án chạy theo 3 giai đoạn và 6 cổng: GĐ1 (tuần 1–12, 4 cổng) là phần lõi để bảo vệ; GĐ2 (dự kiến tuần 13–20) hoàn thiện vòng quyết định, Chat, PDF và thông báo ngoài app; GĐ3 (dự kiến tuần 21–28) làm ứng dụng mobile. Cổng quan trọng nhất là cổng 2 cuối tuần 8, khi mô hình phải đạt điều kiện demo (mục 12.6). Backend và dashboard làm song song từ tuần 4 với dữ liệu dự báo giả lập, nên không phải chờ mô hình.

Kế hoạch 28 tuần · 3 giai đoạn, 6 cổng

| Bản phát hành | Cuối tuần | Nội dung | Điều kiện qua cổng |
| --- | --- | --- | --- |
| R0 – Data ready | 3 | ETL giá (VN30 + HNX30), tin CafeF, BCTC; bảng đặc trưng ngày; nhãn T+2/T+5; báo cáo chất lượng dữ liệu | ≥ 15 mã, ≥ 3 năm; tỷ lệ thiếu < 5%; kiểm tra cut-off 15:00 đạt |
| R1 – Model alpha | 8 | Mô hình cảm xúc tinh chỉnh; baseline; mô hình đa phương thức; ablation 3 cấu hình; báo cáo đánh giá | Đạt điều kiện demo mục 12.6 |
| R2 – MVP | 10 | M1–M7 mức Must-have; batch dự báo hằng ngày; Should-have nếu kịp | AC-01 đến AC-09, AC-12 đến AC-15 đạt |
| R3 – Final | 12 | Kiểm thử người dùng (8–10 người), sửa lỗi, báo cáo đồ án, slide, video demo 3–5 phút, README | KPI P1–P6; đủ sản phẩm bàn giao GĐ1 trong Project Brief |
| R4 – Decision loop (GĐ2) | 20 | M8–M13 mức Must-have: Screener, Portfolio, Trade Plan, Journal, Chat kèm bộ kiểm thử chống bịa, xuất PDF; thông báo email/Telegram (FR-M5-06..08); cập nhật tài liệu và video demo | AC-17 đến AC-24 và AC-26 đạt; KPI P7–P9 đạt; bộ kiểm thử chống bịa đạt ngưỡng P8 |
| R5 – Mobile (GĐ3) | 28 | M14: ứng dụng iOS/Android; kiểm thử trên thiết bị; hướng dẫn cài đặt; báo cáo, slide và video demo bản đầy đủ | AC-25 đạt; KPI P10; đủ sản phẩm bàn giao trong Project Brief 0.0.2 |

Nếu cổng 2 trễ, phần Should-have của GĐ1 (tuần 9–10) được cắt trước, giữ nguyên thời gian kiểm thử và viết báo cáo cho buổi bảo vệ. GĐ2 chỉ bắt đầu sau khi R3 đạt; nếu GĐ2 trễ, Should-have của GĐ2 được cắt trước và GĐ3 lùi theo, không cắt phần lõi của GĐ1.

## 16. Câu hỏi mở & phụ lục

### 16.1 Câu hỏi mở

☑ Chốt tên sản phẩm: dùng IDSS, khớp Project Brief 0.0.2; “StockSense VN” chỉ là tên thương mại tạm.

☐ Chốt các ngưỡng đánh dấu *(cần xác nhận)*: mức vượt baseline +3 điểm Macro F1, Macro F1 ≥ 0,40, AUC ≥ 0,60, hệ số ngưỡng nhãn k = 0,5, SUS ≥ 68; độ chính xác trích dẫn của Chat ≥ 95%; ≥ 70% người thử hoàn thành vòng quyết định; ngưỡng “mẫu nhỏ” n < 50; thông báo trong 5 phút; PDF < 10 giây.

☑ Mobile native: đã chốt đưa vào phạm vi, Must-have ở GĐ3 (Project Brief 0.0.2 và PRD khớp nhau); SDD D7 cần cập nhật theo.

☑ Thống nhất kỳ hạn với tài liệu thiết kế hệ thống: SDD 12.3 đã đánh dấu theo PRD (T+2, T+5).

☑ Thống nhất nhóm người dùng với tài liệu thiết kế: SDD 12.3 đã đánh dấu theo PRD (3 persona chính + người dùng mở rộng theo Brief).

☐ Danh sách 15 mã cụ thể và mốc bắt đầu lịch sử (2018 hay 2021) sau khi kiểm tra độ sâu tin CafeF.

☐ Ngày bắt đầu tuần 1, ngày bảo vệ GĐ1 và lịch GĐ2–GĐ3 để đổi lịch tuần sang ngày thực.

☐ Nguồn BCTC: vnstock hay nguồn khác; có GPU cá nhân hay dùng Colab/Kaggle.

☐ Hội đồng có yêu cầu demo trực tiếp (live) hay chấp nhận video.

☐ Mô hình ngôn ngữ cho Chat chạy cục bộ hay gọi API; ngân sách trần cho mô hình ngôn ngữ, hosting và tài khoản nhà phát triển Apple.

☐ Nhân sự và thời gian GĐ2–GĐ3: vẫn một sinh viên hay thêm người; giảng viên hướng dẫn/hội đồng có chấp nhận lộ trình đến tuần 28 không.

☐ Telegram bot và email: nguồn SMTP miễn phí và hạn mức gửi mỗi ngày (bản demo dùng Gmail SMTP với App Password, giới hạn khoảng 500 người nhận mỗi ngày).

☑ Xác thực email người dùng: có, bắt buộc với tài khoản tự đăng ký (FR-M0-09).

☑ Mở đăng ký công khai cho retail; Trader tự nâng cấp; Analyst cần Admin duyệt và bắt buộc khai email cơ quan (§9.2.6).

☐ Xác nhận email cơ quan bằng thư, TOTP và nguyên tắc hai người khi tạo Admin: để giai đoạn sau (FR-M0-15).

☐ Thời hạn lưu dữ liệu sau khi xóa tài khoản và đầu mối bảo vệ dữ liệu cá nhân của dự án.

☐ Pháp chế xác nhận các điểm ở §7.2 (C6) trước khi mở cho người dùng thật.

☐ Mobile: chốt React Native và hình thức phát hành (TestFlight/bản cài trực tiếp hay đưa lên App Store/Google Play).

☐ Portfolio: phương pháp tính giá vốn (bình quân gia quyền hay FIFO), phí và thuế mặc định.

☐ Bộ kiểm thử chống bịa: số câu hỏi, ngưỡng đạt và người gán đáp án chuẩn.

☐ Dữ liệu mẫu cho Portfolio, Trade Plan, Journal của bản demo và chính sách xóa dữ liệu cá nhân.

### 16.2 Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| T+2 / T+5 | Kỳ hạn dự báo: 2 hoặc 5 phiên giao dịch sau ngày dữ liệu T |
| Macro F1 | Trung bình F1 của 3 lớp, không trọng số; chỉ số chính của đồ án |
| Hit rate | Tỷ lệ dự báo đúng nhãn thực tế sau khi đủ kỳ hạn |
| Ablation | Thí nghiệm bỏ bớt một nguồn dữ liệu để đo đóng góp của nó |
| Point-in-time | Chỉ dùng dữ liệu đã công bố tại thời điểm dự báo |
| Snapshot dữ liệu | Bản ghi cố định tập đặc trưng đầu vào của một dự báo, dùng để tái lập |
| SHAP | Phương pháp đo đóng góp từng đặc trưng vào một dự báo |
| Trade Plan | Kế hoạch giao dịch do người dùng tự lập (vùng vào, cắt lỗ, mục tiêu, lý do), gắn snapshot dự báo lúc lập |
| Journal | Nhật ký quyết định, tự tạo khi đóng Trade Plan và so sánh quyết định với dự báo |
| R:R | Tỷ lệ lợi nhuận kỳ vọng trên rủi ro của một kế hoạch: (mục tiêu − giá vào) / (giá vào − cắt lỗ) |
| Xác thực email | Bước người dùng bấm liên kết một lần trong thư để chứng minh sở hữu địa chỉ email trước khi được đăng nhập |
| Bản ghi đồng ý | Bằng chứng người dùng đã đồng ý một văn bản (loại, phiên bản, thời điểm, kênh) |
| Bootstrap Admin | Lệnh tạo tài khoản Admin đầu tiên khi triển khai, chỉ chạy được khi hệ thống chưa có Admin |

### 16.3 Tài liệu tham chiếu

Project Brief CAPSTONE_PB v0.0.4 (29/10/2026); các ghi chú "Project Brief 0.0.2" trong tài liệu là nguồn gốc của quyết định tại thời điểm đó.

Software Design Document CAPSTONE_SDD v0.0.5 (29/10/2026).

Số liệu tài khoản VSDC đến 31/01/2025 trích từ Project Brief.

Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15); Nghị định 356/2025/NĐ-CP; Luật Chứng khoán 2019; Bộ luật Dân sự 2015; Luật Giao dịch điện tử 2023.


> Ghi chú: Tài liệu Word gốc có 2 ảnh/đối tượng hình ảnh nhúng; nội dung văn bản và bảng đã được chuyển đổi, hình ảnh không được nhúng trực tiếp vào Markdown.
