<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Dự án Lâm Mộc Thảo: lưu ý khi sửa mã

- Ngôn ngữ giao diện, tài liệu: tiếng Việt, văn phong hành chính. Tên biến, hàm: tiếng Anh.
- Quy tắc nghiệp vụ nằm ở `src/lib/rules/` dưới dạng hàm thuần, có kiểm thử trong `tests/`. Sửa quy tắc thì sửa kiểm thử tương ứng và ghi căn cứ văn bản (ví dụ `QT-KD-01 bước 5`).
- Mọi Server Action phải gọi `requireUser()` và kiểm tra quyền bằng `can.*` hoặc hàm `visible*` trong `src/lib/queries/access.ts`.
- Ngưỡng tiền, tỷ lệ lấy từ `CompanySetting` và `Segment`, không viết cứng trong mã.
- Tiền VND là số nguyên (`roundVnd`). Ngày thuần lưu 00:00 UTC; dùng các hàm trong `src/lib/rules/dates.ts`.
- Không chạy lệnh xóa hay đặt lại cơ sở dữ liệu (`prisma migrate reset`, `DROP DATABASE`) trên cơ sở dữ liệu thật. Kiểm thử end-to-end tự tạo và tự xóa cơ sở dữ liệu riêng `lmt_e2e_*`.
