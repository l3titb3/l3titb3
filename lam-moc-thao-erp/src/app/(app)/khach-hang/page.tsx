import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, customerScope } from '@/lib/permissions'
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui'
import { Input, Select } from '@/components/form'
import { CUSTOMER_STATUS_LABEL, CUSTOMER_TYPE_LABEL } from '@/lib/labels'
import { formatVnd } from '@/lib/rules/money'
import { isDeliveryOnHold, outstanding } from '@/lib/rules/aging'
import { todayVN } from '@/lib/rules/dates'
import { salesPeople } from '@/lib/queries/access'

export const metadata = { title: 'Khách hàng' }

const STATUS_TONE = { TIEM_NANG: 'blue', DANG_GIAO_DICH: 'green', NGUNG: 'gray' } as const

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const q = sp.q?.trim()
  const where: Prisma.CustomerWhereInput = {
    AND: [
      customerScope(user),
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { contactPhone: { contains: q } },
              { taxCode: { contains: q } },
              { contactName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      sp.status ? { status: sp.status as Prisma.EnumCustomerStatusFilter['equals'] } : {},
      sp.owner === 'none' ? { ownerId: null } : sp.owner ? { ownerId: sp.owner } : {},
    ],
  }
  const [customers, owners] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { owner: { select: { name: true } }, receivables: { select: { amount: true, paidAmount: true, dueDate: true } } },
    }),
    salesPeople(),
  ])
  const today = todayVN()

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Hồ sơ khách hàng, người liên hệ, công nợ. Nhập dữ liệu trong ngày tiếp nhận (QT-KD-01 bước 1)."
        actions={can.sell(user) && <ButtonLink href="/khach-hang/moi">+ Thêm khách hàng</ButtonLink>}
      />
      <Card>
        <form className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_12rem_auto]" method="get">
          <Input name="q" defaultValue={q} placeholder="Tìm theo tên, mã, số điện thoại, MST" />
          <Select name="status" defaultValue={sp.status ?? ''} placeholder="Mọi trạng thái" options={Object.entries(CUSTOMER_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select
            name="owner"
            defaultValue={sp.owner ?? ''}
            placeholder="Mọi người phụ trách"
            options={[{ value: 'none', label: 'Chưa giao' }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
          />
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">Lọc</button>
        </form>
        {customers.length === 0 ? (
          <EmptyState title="Chưa có khách hàng phù hợp">Thêm khách hàng mới hoặc đổi điều kiện lọc.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Mã</Th>
                <Th>Khách hàng</Th>
                <Th>Liên hệ</Th>
                <Th>Phụ trách</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Còn phải thu</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const debt = c.receivables.reduce((s, r) => s + outstanding(r), 0)
                const hold = isDeliveryOnHold(c.receivables, today)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <Td className="num whitespace-nowrap text-muted">{c.code}</Td>
                    <Td>
                      <Link href={`/khach-hang/${c.id}`} className="font-semibold text-ink hover:text-brand">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {CUSTOMER_TYPE_LABEL[c.type]}
                        {c.industry ? ` · ${c.industry}` : ''}
                        {c.area ? ` · ${c.area}` : ''}
                      </div>
                    </Td>
                    <Td>
                      <div>{c.contactName ?? <span className="text-gap">Chưa ghi</span>}</div>
                      <div className="text-xs text-muted">{c.contactPhone}</div>
                    </Td>
                    <Td>{c.owner?.name ?? <span className="text-gap">Chưa giao</span>}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[c.status]}>{CUSTOMER_STATUS_LABEL[c.status]}</Badge>
                    </Td>
                    <Td className="num text-right">
                      {debt > 0 ? formatVnd(debt) : '-'}
                      {hold && (
                        <div>
                          <Badge tone="red">Tạm dừng giao hàng</Badge>
                        </div>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
