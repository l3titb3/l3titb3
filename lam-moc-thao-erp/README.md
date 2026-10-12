# Phần mềm quản trị Công ty TNHH Lâm Mộc Thảo

Phần mềm web nội bộ dùng cho 05 người dùng năm đầu, theo cơ cấu tại Danh mục hồ sơ quản trị nội bộ phiên bản 3.0 (Giám đốc, PGĐ Kinh doanh, PGĐ Kỹ thuật - Thi công, Phòng Hành chính - Kế toán, Phòng Kinh doanh).

**Giai đoạn 1 (bản này): bán hàng.** Khách hàng, cơ hội bán hàng, khảo sát, báo giá, hợp đồng, công nợ phải thu, việc cần làm, tổng quan.
Giai đoạn 2: hành chính nhân sự, KPI, lương. Giai đoạn 3: kho - vườn ươm, công việc - đào tạo, kế toán quản trị.

## Chức năng giai đoạn 1

| Phân hệ | Nội dung | Căn cứ |
|---|---|---|
| Tổng quan | Tiền đã thu, hợp đồng mới ký, phễu bán hàng, tuổi nợ, tỷ lệ nợ quá hạn trên 30 ngày, chất lượng dữ liệu khách hàng, việc cần xử lý | QT-KD-01, Quy chế tài chính, Quy chế phân bổ LN Điều 9a |
| Khách hàng | Hồ sơ khách lẻ / tổ chức, người liên hệ, hạn mức nợ, lịch sử chăm sóc, chống trùng MST và số điện thoại | QT-KD-01 bước 1, mục 4; Quy chế tài chính Điều 6 |
| Cơ hội bán hàng | Tiếp nhận nhu cầu, phân loại, bảng theo giai đoạn, cảnh báo chậm 15 phút / 02 ngày làm việc, phiếu khảo sát BM-KD-01, lý do không thành | QT-KD-01 bước 1 - 6 |
| Báo giá | Lập báo giá theo bảng giá, tính biên LN gộp, tự xác định cấp duyệt (PGĐ KD / Giám đốc), gửi khách, hẹn gọi lại, bản in BM-KD-02 | QT-KD-01 bước 4 - 6, mục 3 |
| Hợp đồng | 05 loại theo mẫu 03.1 - 03.4, 03.9; đánh số theo mẫu; Phòng HCKT rà soát; cấp ký theo ma trận phê duyệt; mã công trình CT-YYYY-xxx; tạm ứng; nghiệm thu; thanh lý | Quy chế tổ chức Điều 9; Quy chế phân bổ LN Điều 4 |
| Công nợ phải thu | Mỗi hóa đơn / đợt một dòng, phiếu thu, tuổi nợ, biện pháp theo số ngày quá hạn, bản in BM-KD-08 và BM-KD-09 | Quy chế tài chính Điều 6, 7; file 04.3 |
| Việc cần làm | Việc hẹn và việc hệ thống tự tạo: khảo sát, báo giá, gọi lại, hỏi thăm sau 7 và 30 ngày, nhắc nợ | QT-KD-01 bước 3 - 12 |
| Danh mục, thiết lập | Hàng hóa - dịch vụ, mảng kinh doanh và biên lợi nhuận, người dùng, thông tin công ty, tham số quy chế | QT-KD-01 mục 3; file 04.3 |

Chi tiết từng quy tắc và các điểm cần Ban Giám đốc xác nhận: [docs/QUY-TAC-NGHIEP-VU.md](docs/QUY-TAC-NGHIEP-VU.md).
Hướng dẫn sử dụng theo vai trò: [docs/HUONG-DAN-SU-DUNG.md](docs/HUONG-DAN-SU-DUNG.md).
Triển khai lên máy chủ: [docs/TRIEN-KHAI.md](docs/TRIEN-KHAI.md).

## Công nghệ

- Next.js 16 (React 19, TypeScript), giao diện Tailwind CSS 4. Chạy trên trình duyệt máy tính và điện thoại.
- PostgreSQL 16, truy cập qua Prisma 6.
- Kiểm thử: Vitest (quy tắc nghiệp vụ), Playwright (luồng bán hàng end-to-end).

## Chạy trên máy cá nhân

Yêu cầu: Node.js 22, PostgreSQL 16.

```bash
npm install
cp .env.example .env            # sửa DATABASE_URL
npm run db:deploy               # tạo bảng
SEED_PASSWORD='MatKhauTam@2026' npm run db:seed        # thông tin công ty, mảng kinh doanh, 05 tài khoản
SEED_PASSWORD='MatKhauTam@2026' npm run db:seed:demo   # tùy chọn: thêm dữ liệu mẫu để làm quen
npm run dev                     # mở http://localhost:3000
```

Tài khoản khởi tạo (đổi email, họ tên tại Thiết lập > Người dùng):

| Vai trò | Email đăng nhập |
|---|---|
| Giám đốc | giamdoc@lammocthao.local |
| PGĐ phụ trách Kinh doanh | pgd.kinhdoanh@lammocthao.local |
| Chủ tịch HĐTV, kiêm PGĐ Kỹ thuật - Thi công | pgd.kythuat@lammocthao.local |
| Kế toán tổng hợp | ketoan@lammocthao.local |
| Nhân viên kinh doanh | kinhdoanh@lammocthao.local |

Không đặt `SEED_PASSWORD` thì hệ thống sinh mật khẩu ngẫu nhiên cho từng tài khoản, in ra màn hình một lần và buộc đổi ở lần đăng nhập đầu.

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy bản phát triển |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm test` | Kiểm thử quy tắc nghiệp vụ (phê duyệt, biên LN, tuổi nợ, đánh số, đọc số bằng chữ) |
| `npm run build && npm run test:e2e` | Kiểm thử end-to-end; mỗi lần chạy tạo một cơ sở dữ liệu kiểm thử mới rồi xóa khi xong |
| `npm run db:migrate` | Tạo migration khi đổi `prisma/schema.prisma` (chỉ trên máy phát triển) |

## Cấu trúc mã nguồn

```
prisma/schema.prisma        Cấu trúc dữ liệu
prisma/seed.ts              Dữ liệu khởi tạo và dữ liệu mẫu
src/lib/rules/              Quy tắc nghiệp vụ thuần (có kiểm thử): phê duyệt, giá, tuổi nợ, ngày làm việc, đánh số
src/lib/permissions.ts      Quyền xem, quyền thao tác theo vai trò
src/app/(app)/...           Các màn hình; mỗi phân hệ có actions.ts xử lý ghi dữ liệu
src/app/(print)/in/...      Bản in theo biểu mẫu BM-KD-02, 08, 09
tests/                      Kiểm thử quy tắc
e2e/                        Kiểm thử end-to-end
```

Quy ước: tiền VND lưu số nguyên; ngày thuần (hạn thanh toán, ngày hóa đơn) lưu 00:00 UTC; mốc thời gian hiển thị theo giờ Việt Nam. Mỗi quy tắc trong mã có chú thích dẫn chiếu văn bản gốc (ví dụ `QT-KD-01 bước 5`, `Điều 9 Quy chế tổ chức`).
