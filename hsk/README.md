# Aluni HSK

Mô-đun HSK độc lập để phát triển và kiểm tra trước khi tích hợp vào tab HSK của web Aluni.

## Phạm vi V1

- HSK 2.0 và HSK 3.0, mỗi hệ gồm cấp 1–6.
- Danh sách bài theo từng cấp độ.
- Mỗi bài có 2 khu: Viết chữ; Ngữ pháp & Bài tập.
- Luyện đề HSK, HSKK và Kết quả học tập.
- Tab Đăng ký học mở sale page Aluni.

Không thay đổi `index.html`, `admin.html`, Worker hoặc dữ liệu production của Aluni.

## Môi trường thử nghiệm

- `config.js` trỏ riêng tới Worker `aluni-tts-staging`.
- `admin.html` chỉ đọc catalog hiện có để kiểm tra liên kết.
- Luyện đề HSK và HSKK chỉ được xem trước file; nút nhập bị khóa cho đến khi API staging hoàn thiện.
- Không tạo khóa hoặc danh sách bài thứ hai trong module HSK.
