#!/usr/bin/env bash
# Sao lưu cơ sở dữ liệu hằng ngày. Đặt lịch: crontab -e
#   30 23 * * * cd /opt/lam-moc-thao-erp && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/lmt-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U lmt -d lmt --no-owner | gzip > "$file"
echo "$(date '+%F %T') Đã sao lưu: $file ($(du -h "$file" | cut -f1))"
# Giữ 30 bản gần nhất
ls -1t backups/lmt-*.sql.gz | tail -n +31 | xargs -r rm --
