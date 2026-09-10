# Đồng bộ kho đã lưu — bản thử tách từ PR16

PR17 không nằm trong nhánh này. Production không bật tính năng này.

## Phạm vi

- Một hồ sơ đồng bộ gắn với `code_id` từ token đã được Worker xác thực. Cùng mã kích hoạt trên hai thiết bị đã đăng ký dùng cùng kho.
- Không ghép theo tên/email/số điện thoại tự khai. Nhiều mã chưa liên kết thành tài khoản độc lập; cần một cơ chế liên kết có xác thực ở giai đoạn sau.
- Khách học miễn phí vẫn dùng kho local. Không có ghi máy chủ trước khi bấm kết nối.
- Lần kết nối đầu giữ bản sao kho local, mở kho máy chủ, và có nút nhập kho local rõ ràng. Ngắt kết nối mở lại kho local; hàng đợi chưa gửi vẫn giữ riêng theo hồ sơ.
- Giới hạn 500 từ và 500 câu. Nội dung không cấp thêm quyền xem video: chức năng phát lại vẫn kiểm tra quyền qua API gốc.

## Triển khai staging (chưa thực hiện từ phiên phát triển)

1. Kiểm tra Worker staging hiện tại và bindings. Không dùng D1 production. Xuất backup D1 staging và Worker đang chạy trước khi cập nhật.
2. Đối chiếu Worker đang chạy với V98 đã gửi. Tạo bản tích hợp bằng:
   `python account-sync/integrate-worker.py /path/to/current-worker.js /path/to/new-staging-src`
   Script tạo thư mục mới, không ghi đè bản gốc, từ chối nếu điểm tích hợp không đúng. Đã kiểm tra cú pháp với bản V98 gửi ngày 02/09; không có nghĩa là đã xác minh Worker đang chạy.
3. Chạy `account-sync/schema.sql` trên D1 staging. Chỉ thêm hai bảng; không sửa bảng khóa học hay mã kích hoạt.
4. Giữ bindings/secrets staging hiện có; đổi main sang bản nguồn vừa tạo. Bật biến `SAVED_LIBRARY_SYNC=true` ở staging rồi triển khai.
5. Mở Pages preview của nhánh với `?saved_sync=1`. Chỉ URL pages.dev có tham số này mới đổi API sang `https://aluni-tts-staging.nhangohcm.workers.dev` và tải module sync.
6. Kích hoạt bằng mã **staging** trên hai thiết bị. Vào Viết chữ → Đồng bộ từ và câu đã lưu → chọn hồ sơ, kết nối, nhập kho local nếu muốn.
7. Kiểm tra lưu/bỏ lưu từ và câu trên hai máy, tải lại, tắt mạng, đổi hồ sơ, thu hồi thiết bị, hết hạn, ngắt kết nối. Khi mở trang lại cần giữ tham số `saved_sync=1`.

Chưa triển khai live Worker/D1, chưa thử browser thật/hai điện thoại. Không merge trước khi các bước này hoàn thành. Cloudflare chưa được kết nối trong phiên phát triển.

## An toàn dữ liệu và xung đột

API chỉ tin code_id trong token do `getBearerPayload` xác thực; bắt buộc token gắn đúng device header, thiết bị còn đăng ký, mã active và chưa hết hạn. Body không chọn được chủ kho. GET/POST đều no-store. Token cũ chưa gắn thiết bị phải xác minh/kích hoạt lại qua luồng gốc.

Mỗi cập nhật có revision và commit_id. Cập nhật revision có điều kiện, kèm biên nhận commit trong một D1 batch. Biên nhận giữ lại để retry sau khi mất phản hồi không làm sống lại mục đã xóa. Không tự dọn biên nhận nếu chưa có chính sách hết hạn hàng đợi.

Client lưu thao tác thêm/bỏ từng mục thành khóa riêng; gửi lại trên nền dữ liệu máy chủ mới khi xung đột. Web Locks ngăn hai tab gửi đồng thời. Không có Web Locks thì không đồng bộ và báo rõ, kho local vẫn dùng được. Token đổi sang code_id khác sẽ tách hồ sơ và ẩn kho cũ. Đồng bộ khi bấm nút, sau thao tác lưu, online hoặc focus; không phải cập nhật đẩy thời gian thực.

D1 transaction semantics: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

## Kiểm tra đã thực hiện

`npm --prefix tests install` rồi `npm --prefix tests test` (Node 24+ để chạy node:sqlite).

- Suite cũ: câu lưu, viết chữ, bộ thủ và lối vào kho chung.
- API chạy SQL thật bằng SQLite in-memory: cách ly chủ kho, hai thiết bị, token sai, mã blocked/expired, thiết bị thu hồi, giả owner trong body, payload sai/giới hạn, revision conflict, retry idempotent.
- Core sync: thêm từ đồng thời, xóa không hồi sinh, mất phản hồi sau commit, offline giữ outbox, sai owner không xóa outbox.
- DOM mô phỏng: opt-in, không tự nhập kho khách, nhập chủ động, bỏ lưu, ngắt kết nối khôi phục kho khách, đổi hồ sơ, flag tắt.

## Hoàn tác

Tắt `SAVED_LIBRARY_SYNC` và bỏ `?saved_sync=1`; frontend production không bị tác động. Giữ hai bảng mới và local outbox/cache để tránh mất dữ liệu, không DROP bảng. Có thể triển khai lại Worker backup nếu bản staging có vấn đề.


## Tài khoản miễn phí (staging, 10/09/2026)

Bật thêm FREE_ACCOUNT_SYNC=true trên Worker, chạy accounts-schema.sql sau schema.sql.
Pages học viên và Admin phải có ?saved_sync=1&free_accounts=1. Mặc định vẫn tắt.
Tên tài khoản 4–32 ký tự, tên hiển thị tối đa 80. Giao diện tạo ngẫu nhiên mã đăng nhập và mã khôi phục 256 bit; không dùng tên/SĐT/email làm bằng chứng sở hữu. Người dùng lưu mã trước khi mở kho. Mã không phải mã khóa học.
Mã chỉ lưu dạng SHA-256 trên D1; phiên đăng nhập 30 ngày, đăng xuất thu hồi phiên hiện tại; khôi phục xoay mã và vô hiệu hóa mọi phiên cũ bằng auth_version. Bản nháp mã ở sessionStorage giúp thử lại khi mất phản hồi; xóa khi đã lưu mã và mở kho.
Kho miễn phí dùng ID âm trong saved_libraries, tách khỏi code_id dương; không cấp quyền xem khóa học. Không tự gộp kho cũ theo mã vào tài khoản mới.
Admin tab Tài khoản đồng bộ dùng X-Admin-Key cũ, phân trang 50 dòng: tên, ngày tạo/đăng nhập, trạng thái, số từ/câu. Không trả hashes hay secrets. Tên hiển thị render bằng textContent.
Giới hạn thử: 1000 tài khoản, 30 lần đăng ký/đăng nhập/khôi phục mỗi IP mỗi giờ; cần đánh giá chống abuse mạnh hơn trước khi mở đăng ký rộng rãi.
Chưa có gửi email, đổi username, quản lý tài khoản miễn phí qua điện thoại hay tự khôi phục khi mất cả hai mã. Chưa kiểm thử đăng ký trên Cloudflare thực tế.
