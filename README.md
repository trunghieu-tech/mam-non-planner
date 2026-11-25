# Mầm Non Planner — Hệ thống Lập Kế hoạch Giáo dục Mầm non Chuẩn Bộ GD&ĐT

Ứng dụng web hỗ trợ Giáo viên và Ban Giám hiệu trường mầm non lập **Kế hoạch Giáo dục khép kín 6 bước** tuân thủ **Chương trình GDMN `01/VBHN-BGDĐT`** (đủ 345 Mã Mục tiêu cho 4 độ tuổi: Nhà trẻ 24–36 tháng, Mầm 3–4 tuổi, Chồi 4–5 tuổi, Lá 5–6 tuổi) và thể thức hành chính **Nghị định `30/2020/NĐ-CP`**.

## Quy trình 6 bước khép kín

1. **Năm học & Thời khóa biểu (`1. Năm học & TKB`):** Quản lý ma trận 9 Chủ đề tháng, đánh dấu Ngôi sao Đánh giá (`★`), phát triển Mục tiêu mở rộng của lớp, thiết lập Thời khóa biểu Tuần Lẻ / Tuần Chẵn và Hồ sơ Lớp (nhập nhanh danh sách trẻ từ Excel).
2. **KHGD Tháng & Lập lịch Tuần (`2. KH Tháng & Tuần`):** Phân bổ Mã MT từ Tháng xuống Tuần 1..4, cảnh báo đỏ các `★ MT` chưa gắn tiết dạy, tự động xếp lịch Thứ 2 → Thứ 6 và đánh dấu ngày nghỉ Lễ.
3. **Hoạt động cả tuần (`3. Hoạt động cả tuần`):** Thiết lập 1 lần cho cả tuần gồm Mục tiêu tuần, Thể dục sáng, Bảng 5 Góc chơi, Hoạt động Ngoài trời, Chế độ sinh hoạt 7h–17h & Lễ giáo.
4. **Giáo án Ngày (`4. Giáo án Ngày`):** Trình soạn Word WYSIWYG (Tiptap) tách gọn từng tiết, chèn 1 chạm Kho Ngữ liệu (thơ, truyện, bài hát, 29 chữ cái tiếng Việt), đính kèm Media, lưu Bài giảng mẫu cá nhân và xuất **Sổ Giáo án Ngày (`.docx`)**.
5. **Bản in A4 (`5. Bản in A4`):** Tự động tổng hợp hồ sơ A4 đủ 7 phần có Khóa an toàn gõ tay, kiểm duyệt 6/6 tiêu chí BGD, xuất **Giáo án đầy đủ (`.docx`)**, **Tờ Lịch Tuần 1 trang gửi Phụ huynh (`.docx`)** và **Excel (`.xlsx`)**.
6. **Đánh giá Trẻ 3 tầng & Ký duyệt BGH (`6. Đánh giá & Duyệt`):** Liên thông `Đánh giá Hàng ngày` → `Cuối Chủ đề / Tháng` (3 trạng thái + xuất Phiếu tổng hợp & Phiếu riêng từng trẻ `.docx`) → `Cuối Độ tuổi (Năm)` và luồng trình ký đóng dấu phê duyệt trực tuyến lên trang A4.

## Chạy thử trên máy cá nhân (Localhost)

```bash
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

## Chế độ Live Demo trên GitHub Pages

Khi triển khai tĩnh trên **GitHub Pages**, ứng dụng tự động kích hoạt `staticApiAdapter`:
- Nạp trọn bộ 345 Mã MT, Kho Ngữ liệu tác phẩm và 1.050 tài liệu giáo án thực tế từ `public/static-data/`.
- Lưu trữ mọi thao tác chỉnh sửa trực tiếp vào `localStorage` của trình duyệt.
- Xuất trực tiếp toàn bộ các file Word (`.docx`) và Excel (`.xlsx`) ngay trên trình duyệt mà không cần máy chủ phụ trợ.
