# Bản thử Viết chữ và quyền Shadowing

## Những thay đổi đã có

1. Ô luyện viết dùng khung chữ điền có đường dọc và ngang ở giữa, giúp học viên canh vị trí nét khi áp dụng vào vở.
2. Ô tìm kiếm vẫn ưu tiên chữ/câu trong kho Aluni. Nếu không tìm thấy, người dùng có thể nhập tiếng Việt để nhận bản dịch tiếng Trung tham khảo rồi mở chữ để luyện viết.
3. Admin có hai loại mã riêng:
   - `COURSE_ACCESS`: mở khóa học và Shadowing thuộc chính khóa đó.
   - `SHADOWING_PASS`: mở kho Shadowing độc lập và Hoạt hình, không mở khóa học trả phí.

## Thiết lập gói Shadowing lần đầu

1. Vào `admin.html` và đăng nhập.
2. Mở tab **Mã kích hoạt**.
3. Chọn **Shadowing theo năm — SHADOWING_PASS**.
4. Bấm **Khởi tạo gói Shadowing 1 năm** đúng một lần.
5. Tạo mã Shadowing riêng như bình thường.

Gói này là một sản phẩm quyền ẩn nên không xuất hiện trong danh sách khóa học của học viên và không xuất hiện trong các ô biên soạn bài học.

## Gắn quyền cho nội dung

- Shadowing nằm trong một khóa học: giữ `product_course_id` là mã của khóa học đó. Các bài thử miễn phí tiếp tục theo cấu hình của khóa.
- Shadowing độc lập hoặc Hoạt hình bán theo năm: chọn **Gói Shadowing toàn kho · 1 năm** tại trường **Gói/mã kích hoạt** của playlist.
- Nội dung miễn phí: để chế độ miễn phí và không bắt buộc gói quyền.

## Lưu ý kiểm thử

- Bản dịch Việt → Trung bên ngoài kho Aluni cần kết nối Internet và chỉ là bản dịch tham khảo.
- Thời hạn thực tế hiển thị theo `expires_at` do backend cấp khi kích hoạt. Hãy kiểm tra một mã thử để xác nhận backend hiện đặt đúng 365 ngày.
- Nên thử trên một cửa sổ ẩn danh trước khi đưa lên web chính: mã khóa học không được mở kho Shadowing độc lập, và mã Shadowing không được mở khóa học trả phí.
