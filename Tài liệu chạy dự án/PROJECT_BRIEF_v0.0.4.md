# PROJECT BRIEF

| CODE | CAPSTONE_PB |
| --- | --- |
| VERSION | 0.0.4 |
| STATUS | TEST |
| AUTHOR | HOANG MINH TUAN |
| VERIFY | HOANG MINH TUAN |
| UPDATE | 31/10/2026 |
| RELATED DOCUMENT | PRD v0.0.4; SDD v0.0.5 |

| Phiên bản | Ngày | Người sửa | Nội dung thay đổi |
| --- | --- | --- | --- |
| 0.0.1 | 7/10/2026 | Hoang Minh Tuan | Khởi tạo tài liệu. |
| 0.0.2 | 8/10/2026 | Hoang Minh Tuan | Mở rộng phạm vi: thêm vòng quyết định, Chat, PDF, thông báo, mobile; chia 3 giai đoạn; thống nhất tên IDSS. |
| 0.0.3 | 09/10/2026 | Tran Trong Dai | Đồng bộ với PRD v0.0.3 |
| 0.0.4 | 29/10/2026 | Tran Trong Dai | Bổ sung luồng đăng ký và vòng đời tài khoản vào phạm vi; đồng bộ PRD v0.0.4, SDD v0.0.5. Rà soát 30/10/2026: thống nhất tên nhãn Tăng / Đi ngang / Giảm; Screener lưu bộ lọc cho trader, analyst; Journal liên kết Trade Plan đã đóng hoặc ghi thủ công; PDF Journal cho trader, analyst; phạm vi mã là 15 mã HOSE và lịch sử giá 5 năm do nhóm mô hình chốt (31/10/2026); thông báo trên mobile qua danh sách trong app và email/Telegram; ghi ngăn xếp kỹ thuật. |

# Tổng quan dự án

Thị trường chứng khoán Việt Nam có số lượng nhà đầu tư cá nhân tham gia lớn. Theo VSDC, tính đến 31/01/2025, thị trường có 9.330.766 tài khoản giao dịch trong nước, trong đó 9.312.987 tài khoản thuộc nhà đầu tư cá nhân và chỉ 17.779 tài khoản thuộc nhà đầu tư tổ chức; tức tài khoản cá nhân chiếm khoảng 99,81% tổng số tài khoản trong nước. Tuy nhiên, nhà đầu tư thường phải tự tổng hợp nhiều nguồn thông tin rời rạc như dữ liệu giá–khối lượng, chỉ số tài chính doanh nghiệp, tin tức và nhận định thị trường. Việc xử lý thủ công khó đảm bảo nhanh, khách quan và nhất quán, đặc biệt khi tin tức có thể ảnh hưởng đến tâm lý thị trường trong ngắn hạn. Các nghiên cứu gần đây cũng đang khai thác mô hình đa phương thức để kết hợp dữ liệu tài chính với nội dung văn bản nhằm dự báo biến động chứng khoán.

Dự án được khởi xướng nhằm xây dựng IDSS (Investment Decision Support System) – hệ thống hỗ trợ quyết định đầu tư cổ phiếu, sử dụng mô hình học sâu đa phương thức để hợp nhất hai nhóm tín hiệu: đặc trưng định lượng từ dữ liệu giá/chỉ số tài chính và đặc trưng định tính từ cảm xúc tin tức. Kết quả dự báo là xác suất xu hướng Tăng, Đi ngang hoặc Giảm theo từng kỳ hạn dự báo, đi kèm các yếu tố giải thích chính. Từ dự báo, hệ thống đưa người dùng đi hết một vòng quyết định: sàng lọc cổ phiếu (Screener), tự lập kế hoạch giao dịch (Trade Plan), theo dõi danh mục (Portfolio) và ghi lại, nhìn lại các quyết định trong nhật ký (Journal); đồng thời có Chat hỏi đáp dựa trên dữ liệu của hệ thống. Tên chính thức của hệ thống là IDSS; “StockSense VN” chỉ là tên thương mại tạm và không dùng trong tài liệu kỹ thuật.

***IDSS là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư, không cam kết lợi nhuận và không tự động đặt lệnh giao dịch. Trade Plan do người dùng tự lập và tự chịu trách nhiệm; Chat hỏi đáp chỉ trả lời dựa trên dữ liệu của hệ thống và không đưa ra lệnh mua/bán. Dự báo, tín hiệu, Trade Plan và nội dung Chat đều không phải tư vấn đầu tư.***

# Mục tiêu dự án

| Mục tiêu SMART | Chỉ số đo lường / tiêu chí nghiệm thu |
| --- | --- |
| Xây dựng bộ dữ liệu hợp nhất cho 15 mã cổ phiếu thanh khoản cao trên HOSE (FPT, VNM, STB, ACB, SSI, VIC, HPG, VCB, MSN, MBB, GAS, MWG, VPB, VRE, TCB), đồng bộ dữ liệu giá, chỉ số tài chính và tin tức theo ngày giao dịch. | 15 mã cổ phiếu HOSE; lịch sử giá 5 năm (giá đã điều chỉnh cho chia cổ tức bằng cổ phiếu, thưởng cổ phiếu và tách cổ phiếu); có kiểm tra dữ liệu thiếu, trùng và sai lệch thời gian. |
| Phát triển mô hình phân loại đa phương thức dự báo xu hướng Tăng / Đi ngang / Giảm tại các mốc T+2 và T+5. | Có ít nhất một mô hình cơ sở và một mô hình đa phương thức để đối chiếu; đầu ra gồm nhãn xu hướng và xác suất cho từng lớp. |
| Chứng minh mức đóng góp của dữ liệu cảm xúc tin tức. | So sánh ít nhất 3 cấu hình: chỉ dữ liệu định lượng, chỉ dữ liệu văn bản/cảm xúc, và mô hình kết hợp đa phương thức. |
| Đánh giá mô hình theo quy trình kiểm thử chuỗi thời gian. | Báo cáo Accuracy, Precision, Recall, Macro F1-score, AUC-ROC phù hợp bài toán đa lớp; đánh giá trên tập kiểm tra chưa từng dùng khi huấn luyện. |
| Xây dựng giao diện để người dùng tra cứu dự báo. | (GĐ1) Người dùng chọn mã cổ phiếu và kỳ hạn T+2/T+5, xem dự báo, xác suất, tín hiệu cảm xúc, biểu đồ dữ liệu và giải thích mô hình. |
| Xây dựng Screener để sàng lọc cổ phiếu theo tín hiệu dự báo. | (GĐ2) Lọc được theo tối thiểu kỳ hạn T+2/T+5, nhãn xu hướng và ngưỡng xác suất; kết quả khớp với dự báo đã lưu; có bộ lọc mẫu cho mọi người, trader và analyst lưu và dùng lại được bộ lọc riêng. |
| Xây dựng Portfolio để theo dõi danh mục do người dùng tự nhập. | (GĐ2) Nhập tay hoặc import CSV (báo rõ dòng lỗi); tính giá vốn, lãi/lỗ tạm tính và tỷ trọng từng mã; không kết nối API công ty chứng khoán. |
| Xây dựng Trade Plan để người dùng tự lập kế hoạch giao dịch. | (GĐ2) Người dùng tự nhập mã, vùng vào, mục tiêu, cắt lỗ và lý do; tính tỷ lệ lợi nhuận/rủi ro; theo dõi trạng thái kế hoạch; hệ thống không tự đề xuất điểm vào/ra và không tự đặt lệnh. |
| Xây dựng Journal để ghi lại và nhìn lại các quyết định. | (GĐ2) Ghi chép tự tạo khi đóng Trade Plan (kèm dự báo tại thời điểm lập kế hoạch) hoặc ghi thủ công theo mã; lọc theo mã, thời gian, thẻ, kết quả; thống kê kết quả các kế hoạch đã đóng. |
| Xây dựng Chat hỏi đáp dựa trên dữ liệu của hệ thống. | (GĐ2) Chỉ trả lời từ dữ liệu của IDSS (dự báo, giải thích, dữ liệu của chính người dùng) và nêu nguồn; từ chối đưa lệnh mua/bán; có bộ kiểm thử chống bịa và báo cáo kết quả đạt theo ngưỡng nêu trong PRD. |
| Xuất báo cáo PDF. | (GĐ2) Xuất được PDF cho dự báo của một mã, danh mục, Trade Plan và Journal theo kỳ (Journal: trader, analyst); PDF ghi rõ thời điểm dữ liệu, phiên bản mô hình và tuyên bố không phải tư vấn đầu tư. |
| Gửi thông báo qua email và Telegram. | (GĐ2) Người dùng đăng ký/hủy từng kênh; thông báo gửi đúng kênh khi dự báo thay đổi hoặc giá chạm mốc trong Trade Plan; có nhật ký gửi và kèm tuyên bố không phải tư vấn đầu tư. |
| Xây dựng ứng dụng mobile native cho iOS và Android. | (GĐ3) Xây dựng bằng React Native, dùng chung API với web; chạy được trên cả iOS và Android với các chức năng cốt lõi: tra cứu dự báo, watchlist, Portfolio, Trade Plan và xem cảnh báo (danh sách trong ứng dụng, kèm email/Telegram như web; chưa có thông báo đẩy). |
| Hoàn thiện sản phẩm, mã nguồn và báo cáo theo ba giai đoạn, trong đó GĐ1 là phần lõi phải xong trước thời điểm bảo vệ. | GĐ1 – bảo vệ lõi (tuần 1–12): dữ liệu, mô hình, đánh giá, giải thích, dashboard tra cứu dự báo, watchlist, phân quyền; có video demo, tài liệu cài đặt và hướng dẫn sử dụng. |
| Hoàn thiện các module vòng quyết định và dịch vụ mở rộng. | GĐ2 – vòng quyết định (dự kiến tuần 13–20): Screener, Portfolio, Trade Plan, Journal, Chat hỏi đáp, xuất PDF, thông báo email/Telegram; có bộ kiểm thử chống bịa cho Chat. |
| Hoàn thiện ứng dụng mobile. | GĐ3 – mobile (dự kiến tuần 21–28): ứng dụng iOS/Android hoàn chỉnh, kiểm thử trên cả hai nền tảng; cập nhật tài liệu và video demo. |

# Đối tượng mục tiêu

| Nhóm người dùng | Đặc điểm | Nhu cầu chính | Giá trị nhận được |
| --- | --- | --- | --- |
| Nhà đầu tư cá nhân | Khoảng 22–45 tuổi, sinh sống chủ yếu tại đô thị, dùng web/mobile để theo dõi thị trường, kinh nghiệm từ mới bắt đầu đến trung bình. | Cần một tín hiệu ngắn hạn dễ hiểu thay vì tự đọc nhiều biểu đồ và tin tức; cần tự lập kế hoạch giao dịch, theo dõi danh mục và nhìn lại các quyết định của mình. | Xem dự báo Tăng / Đi ngang / Giảm, mức xác suất, tin tức liên quan và danh sách mã theo dõi; lập Trade Plan, theo dõi Portfolio và xem lại Journal. |
| Swing trader / active trader | Khoảng 25–45 tuổi, theo dõi thị trường thường xuyên, ưu tiên cơ hội trong vài phiên đến một vài tuần. | Cần sàng lọc nhanh, cảnh báo biến động, đánh giá rủi ro và kiểm chứng tín hiệu; cần lập kế hoạch có điểm vào/cắt lỗ/mục tiêu, theo dõi danh mục và nhìn lại quyết định. | So sánh T+2 với T+5, lọc cổ phiếu bằng Screener, xem hiệu quả lịch sử của dự báo; quản lý Trade Plan, Portfolio và Journal. |
| Nhà phân tích chứng khoán / quant analyst | Nhân sự phân tích tại công ty chứng khoán, quỹ hoặc nhóm đầu tư; có kiến thức dữ liệu và tài chính. | Cần truy vết đầu vào, đánh giá mô hình và hiểu nguyên nhân của một dự báo; cần đối chiếu kế hoạch và danh mục với tín hiệu của mô hình. | Xem đóng góp của nhóm đặc trưng tài chính và cảm xúc tin tức, chỉ số đánh giá và phiên bản mô hình; đối chiếu Trade Plan/Portfolio với dự báo. |
| Hội đồng chấm | Giảng viên và hội đồng đánh giá đồ án; có kiến thức chuyên môn về học máy và tài chính, xem sản phẩm qua báo cáo và buổi demo. | Cần kiểm chứng đóng góp của dữ liệu cảm xúc, khả năng tái lập thí nghiệm, phạm vi rõ ràng và việc tuân thủ nguyên tắc không phải tư vấn đầu tư. | Báo cáo đánh giá, bộ kiểm thử (gồm kiểm thử chống bịa cho Chat), video và kịch bản demo, tài liệu cài đặt. |

Nhà đầu tư cá nhân phù hợp làm nhóm ưu tiên vì họ là lực lượng giao dịch lớn trên thị trường Việt Nam, trong khi swing trader và analyst phù hợp nhất với đặc tính dự báo T+2/T+5 cần tốc độ, khả năng kiểm chứng và giải thích.

**Người dùng mở rộng:**

Môi giới chứng khoán (dùng vai trò Trader/Analyst): dùng hệ thống để chuẩn bị danh sách mã cần theo dõi và hỗ trợ trao đổi thông tin với khách hàng, không dùng dự báo như một khuyến nghị mua/bán bắt buộc.

Quản lý danh mục / phòng đầu tư (dùng vai trò Trader/Analyst): dùng tín hiệu như một lớp sàng lọc và cảnh báo rủi ro khi theo dõi danh mục nhiều mã.

Quản trị viên hệ thống (vai trò Admin): không phải người dùng nghiệp vụ cuối; chịu trách nhiệm quản lý tài khoản, phân quyền, dữ liệu, phiên bản mô hình và nhật ký hệ thống.

Hội đồng chấm: không phải người dùng nghiệp vụ; truy cập bản demo, báo cáo và tài liệu để đánh giá tính học thuật, khả năng tái lập và mức độ tuân thủ phạm vi của dự án.

# Phạm vi công việc

## Trong phạm vi

Thu thập, làm sạch & đồng bộ dữ liệu lịch sử, giá, khối lượng giao dịch, chỉ số kỹ thuật / chỉ số tài chính & tin tức liên quan đến cổ phiếu.

Xây dựng pipeline xử lý văn bản tiếng Việt: loại bỏ nhiễu, chuẩn hóa, phân tích cảm xúc & tạo đặc trưng văn bản.

Xây dựng nhãn xu hướng Tăng / Đi ngang / Giảm cho T+2, T+5 theo quy tắc ngưỡng được định nghĩa rõ trong tài liệu kĩ thuật.

Huấn luyện, tinh chỉnh và so sánh mô hình cơ sở với mô hình học sâu đa phương thức.

Đánh giá theo thứ tự thời gian để tránh rò rỉ dữ liệu tương lai vào quá trình huấn luyện.

Phát triển dashboard web cho phép chọn mã, chọn kỳ xem, xem dự báo, xác suất, biểu đồ lịch sử, tin tức và giải thích cơ bản.

Xây dựng watchlist cơ bản, lịch sử dự báo & trang đánh giá hiệu năng mô hình.

Xây dựng Screener sàng lọc cổ phiếu theo tín hiệu dự báo (GĐ2).

Xây dựng Portfolio theo dõi danh mục do người dùng nhập tay hoặc import CSV (GĐ2).

Xây dựng Trade Plan để người dùng tự lập kế hoạch giao dịch; hệ thống không tự sinh kế hoạch hay lệnh (GĐ2).

Xây dựng Journal ghi lại và nhìn lại các quyết định (GĐ2).

Xây dựng Chat hỏi đáp dựa trên dữ liệu của hệ thống, không đưa lệnh mua/bán và có bộ kiểm thử chống bịa (GĐ2).

Xuất báo cáo PDF và gửi thông báo qua email/Telegram (GĐ2).

Phát triển ứng dụng mobile native cho iOS và Android bằng React Native, dùng chung API với web, thực hiện ở GĐ3.

Công nghệ: Node.js (Fastify) cho API và worker dữ liệu, React + Vite cho web, PostgreSQL; Python cho phần huấn luyện và suy luận mô hình (chi tiết ở SDD mục 3.2).

Xác thực người dùng (đăng nhập, đăng xuất, khóa tạm khi nhập sai nhiều lần, đổi mật khẩu) và phân quyền theo 4 vai trò: retail, trader, analyst và admin (khớp PRD NFR-08).

Đăng ký và vòng đời tài khoản (PRD UC-26..UC-29, FR-M0-08..15): người dùng tự đăng ký tài khoản retail bằng email và xác thực email; retail tự nâng cấp lên trader; quyền analyst cần Admin duyệt; Admin đầu tiên tạo bằng lệnh bootstrap khi triển khai, không đăng ký công khai; ghi nhận đồng ý điều khoản và xử lý dữ liệu, người dùng tự xóa được tài khoản, theo Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025. Quy tắc chi tiết ở PRD §9.2.6.

Tự động cập nhật dự báo sau mỗi phiên giao dịch (thử lại khi lỗi, báo cho admin); lưu nhật ký dữ liệu, lần chạy mô hình, dự báo và hành động quản trị (không sửa, không xóa); cho phép xem đầu vào và chạy lại để tái lập dự báo, phục vụ truy vết và kết quả nghiên cứu

## Ngoài phạm vi

Tự động đặt lệnh mua/bán hoặc tích hợp trực tiếp với hệ thống giao dịch của công ty chứng khoán; Portfolio chỉ nhập tay hoặc import CSV, không kết nối API công ty chứng khoán.

Cam kết lợi nhuận, đưa ra tư vấn đầu tư cá nhân hóa hoặc đảm bảo độ chính xác của dự báo.

Phủ toàn bộ mã cổ phiếu, cổ phiếu HNX và UPCoM, phái sinh, chứng quyền, trái phiếu, quỹ hoặc thị trường quốc tế.

Dữ liệu tick-by-tick, giao dịch tần suất cao và suy luận thời gian thực ở mức mili-giây.

Chức năng social trading, diễn đàn và sao chép lệnh.

Chatbot tư vấn đầu tư (đưa khuyến nghị mua/bán hoặc tư vấn cá nhân hóa); Chat hỏi đáp dựa trên dữ liệu của hệ thống thuộc phạm vi, nhưng không đưa lệnh.

Tích hợp dữ liệu trả phí quy mô doanh nghiệp nếu chưa có giấy phép/bản quyền khai thác.

Việc tách rõ phạm vi giúp dự án giữ trọng tâm ở đóng góp học thuật: dữ liệu đa phương thức, dự báo xu hướng ngắn hạn và khả năng giải thích.

# Sản phẩm bàn giao

| Sản phẩm | Nội dung và tiêu chuẩn |
| --- | --- |
| Tài liệu yêu cầu và kiến trúc | Project brief, use case, sơ đồ kiến trúc, sơ đồ dữ liệu, quy tắc tạo nhãn và phạm vi chức năng. |
| Bộ dữ liệu đã xử lý | Dữ liệu giá/chỉ số/tin tức đã được làm sạch, mô tả dữ liệu, từ điển đặc trưng và quy tắc đồng bộ thời gian. |
| Mã nguồn pipeline dữ liệu | Mã thu thập, tiền xử lý, tạo đặc trưng, tạo nhãn và kiểm tra chất lượng dữ liệu; có hướng dẫn chạy. |
| Mô hình dự báo | Baseline và mô hình đa phương thức; file trọng số/checkpoint nếu phù hợp; cấu hình tái lập thí nghiệm. |
| Báo cáo đánh giá | So sánh các mô hình theo Accuracy, Precision, Recall, Macro F1-score, AUC-ROC; ma trận nhầm lẫn; phân tích lỗi và kiểm tra ngoài mẫu. |
| Module giải thích | Hiển thị nhóm tín hiệu đóng góp chính, ví dụ các đặc trưng tài chính/cảm xúc ảnh hưởng đến dự báo. |
| Ứng dụng demo | Ứng dụng web responsive: chọn mã, chọn T+2/T+5, xem xác suất xu hướng, biểu đồ, tin tức, lịch sử dự báo và watchlist (GĐ1); cùng các module Portfolio, Trade Plan, Journal, Screener (GĐ2). |
| Module vòng quyết định | Portfolio, Trade Plan, Journal và Screener tích hợp trong ứng dụng, có phân quyền theo vai trò (GĐ2). |
| Dịch vụ Chat hỏi đáp | Dịch vụ Chat trả lời dựa trên dữ liệu hệ thống, kèm bộ kiểm thử chống bịa và báo cáo kết quả kiểm thử (GĐ2). |
| Báo cáo PDF | Chức năng xuất PDF cho dự báo, danh mục và Trade Plan/Journal, có tuyên bố không phải tư vấn đầu tư (GĐ2). |
| Tích hợp Telegram/email | Thông báo qua Telegram và email, cho phép đăng ký/hủy kênh, có nhật ký gửi (GĐ2). |
| Ứng dụng mobile | Ứng dụng iOS/Android bằng React Native, dùng chung API với web, kèm hướng dẫn cài đặt và kiểm thử (GĐ3). |
| Tài liệu người dùng và kỹ thuật | README cài đặt, hướng dẫn sử dụng, API specification nếu có API, tài liệu quản trị tối thiểu |
| Sản phẩm bảo vệ | Luận văn/báo cáo đồ án, slide trình bày, video demo 3–5 phút và kịch bản demo. |
