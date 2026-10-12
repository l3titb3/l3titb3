# Triển khai lên máy chủ

Phần mềm cần một máy chủ chạy liên tục, có cơ sở dữ liệu PostgreSQL và địa chỉ truy cập qua HTTPS. Với 05 người dùng, một máy chủ ảo (VPS) Linux 2 vCPU, 2 - 4 GB RAM, 40 GB ổ đĩa là đủ (ước tính, tăng khi thêm phân hệ). Nên chọn nhà cung cấp có trung tâm dữ liệu tại Việt Nam vì phần mềm chứa dữ liệu cá nhân của khách hàng và người lao động.

## Cách 1: Docker Compose trên VPS (khuyến nghị)

Yêu cầu trên máy chủ: Docker Engine và Docker Compose plugin, tên miền trỏ về máy chủ (ví dụ `quantri.lammocthao.vn`).

```bash
# 1. Lấy mã nguồn
git clone <địa chỉ repo> /opt/lam-moc-thao-erp && cd /opt/lam-moc-thao-erp
cp .env.example .env
# Sửa .env: POSTGRES_PASSWORD (mật khẩu mạnh), COOKIE_SECURE=true

# 2. Khởi động cơ sở dữ liệu, tạo bảng, tạo 05 tài khoản
docker compose up -d db
docker compose run --rm tools                    # prisma migrate deploy
docker compose run --rm tools npm run db:seed    # in mật khẩu tạm của 05 tài khoản, lưu lại

# 3. Chạy ứng dụng (lắng nghe 127.0.0.1:3000)
docker compose up -d --build app
```

### HTTPS bằng Caddy

Cài Caddy trên máy chủ, tạo `/etc/caddy/Caddyfile`:

```
quantri.lammocthao.vn {
    reverse_proxy 127.0.0.1:3000
}
```

`sudo systemctl reload caddy`. Caddy tự xin và gia hạn chứng chỉ HTTPS. Caddy chuyển tiếp đúng tiêu đề Host nên các thao tác lưu dữ liệu (Server Action) hoạt động bình thường; nếu dùng Nginx, cần `proxy_set_header Host $host;` và `proxy_set_header X-Forwarded-Proto $scheme;`.

Chỉ dùng trong mạng nội bộ qua HTTP (không khuyến nghị): đặt `COOKIE_SECURE=false`, `APP_BIND=0.0.0.0` trong `.env`.

### Sao lưu

```bash
crontab -e
30 23 * * * cd /opt/lam-moc-thao-erp && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Script giữ 30 bản gần nhất trong thư mục `backups/`. Nên chép thêm bản sao lưu ra nơi khác (Google Drive của công ty, ổ đĩa ngoài) mỗi tuần. Khôi phục:

```bash
gunzip -c backups/lmt-YYYYMMDD-HHMM.sql.gz | docker compose exec -T db psql -U lmt -d lmt
```

Khôi phục ghi đè dữ liệu hiện có: chỉ làm khi có chỉ đạo của Giám đốc và đã sao lưu bản hiện tại.

### Cập nhật phiên bản

```bash
cd /opt/lam-moc-thao-erp
./scripts/backup.sh
git pull
docker compose run --rm --build tools            # áp dụng migration mới (nếu có)
docker compose up -d --build app
```

## Cách 2: Dịch vụ đám mây có sẵn

Chạy ứng dụng trên một nền tảng hỗ trợ Next.js và PostgreSQL có quản lý (ví dụ Vercel kèm Neon hoặc Supabase). Đặt biến môi trường `DATABASE_URL`, chạy `npx prisma migrate deploy` và `npm run db:seed` một lần từ máy quản trị. Ít việc vận hành hơn nhưng dữ liệu lưu ở nước ngoài; cân nhắc quy định bảo vệ dữ liệu cá nhân trước khi chọn.

## Kiểm tra sau triển khai

1. Đăng nhập bằng tài khoản Giám đốc, đổi mật khẩu.
2. Thiết lập > Thông tin công ty: điền số tài khoản ngân hàng, kiểm tra các ngưỡng phê duyệt.
3. Thiết lập > Người dùng: sửa họ tên, email thật của 05 người; cấp mật khẩu tạm và gửi riêng cho từng người.
4. Danh mục > Hàng hóa - dịch vụ: nhập bảng giá chuẩn đã duyệt.
5. Làm thử một vòng: tạo cơ hội, báo giá, duyệt, hợp đồng, ký, ghi phiếu thu. Kiểm tra bản in.

## Bảo mật

- Mật khẩu lưu dạng băm (bcrypt), phiên đăng nhập 7 ngày, cookie HttpOnly.
- Dữ liệu khách hàng là dữ liệu cá nhân: chỉ cấp tài khoản cho người có nhiệm vụ, khóa tài khoản ngay khi nghỉ việc (Thiết lập > Người dùng > bỏ chọn "Đang hoạt động").
- Không mở cổng PostgreSQL (5432) ra Internet. Docker Compose mặc định chỉ để cơ sở dữ liệu trong mạng nội bộ của Docker.
