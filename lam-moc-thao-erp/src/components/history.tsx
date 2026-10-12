import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/rules/dates'

const ACTION_LABEL: Record<string, string> = {
  TAO: 'Tạo mới',
  SUA: 'Sửa',
  TRINH_DUYET: 'Trình duyệt',
  DUYET: 'Duyệt',
  TRA_LAI: 'Trả lại',
  GUI_KHACH: 'Gửi khách',
  KHACH_DONG_Y: 'Khách đồng ý',
  KHONG_THANH: 'Không thành',
  HUY: 'Hủy',
  TAO_SUA_DOI: 'Tạo bản sửa đổi',
  RA_SOAT: 'Phòng HCKT rà soát',
  DE_XUAT: 'Giám đốc đề xuất',
  PHE_DUYET_KY: 'Phê duyệt, ký',
  HOAN_THANH: 'Nghiệm thu, giao xong',
  THANH_LY: 'Thanh lý',
  CHAP_THUAN_TAM_UNG: 'Giám đốc chấp thuận triển khai trước tạm ứng',
  TRA_VE_SOAN_THAO: 'Trả về soạn thảo',
  GHI_CONG_NO: 'Ghi công nợ',
  THU_TIEN: 'Thu tiền',
  XOA_PHIEU_THU: 'Xóa phiếu thu',
}

export async function History({ entity, entityId }: { entity: string; entityId: string }) {
  const logs = await prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { createdAt: 'desc' }, take: 30, include: { user: { select: { name: true } } } })
  if (logs.length === 0) return <p className="text-sm text-muted">Chưa có lịch sử.</p>
  return (
    <ol className="space-y-2 text-sm">
      {logs.map((l) => (
        <li key={l.id} className="flex flex-wrap gap-x-2">
          <span className="num text-xs text-muted">{formatDateTime(l.createdAt)}</span>
          <span className="font-medium">{l.user?.name ?? 'Hệ thống'}</span>
          <span>{ACTION_LABEL[l.action] ?? l.action}</span>
          {l.detail && !/^[A-Z_]+$/.test(l.detail) && <span className="text-muted">· {l.detail}</span>}
        </li>
      ))}
    </ol>
  )
}
