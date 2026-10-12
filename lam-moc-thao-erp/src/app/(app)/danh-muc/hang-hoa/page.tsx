import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Input, Select } from '@/components/form'
import { ProductFields } from '@/components/product-fields'
import { PRODUCT_GROUPS } from '@/lib/labels'
import { formatPercent, formatVnd } from '@/lib/rules/money'
import { grossMarginPercent } from '@/lib/rules/pricing'
import { saveProduct } from '../actions'

export const metadata = { title: 'Hàng hóa - dịch vụ' }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  const where: Prisma.ProductWhereInput = {
    ...(sp.group ? { group: sp.group } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: 'insensitive' } }, { name: { contains: sp.q, mode: 'insensitive' } }] } : {}),
  }
  const products = await prisma.product.findMany({ where, orderBy: [{ active: 'desc' }, { code: 'asc' }] })
  const manage = can.manageProducts(user)
  return (
    <>
      <PageHeader title="Hàng hóa - dịch vụ" description="Bảng giá chuẩn do Phòng KD lập, Giám đốc duyệt, cập nhật mỗi quý (QT-KD-01 mục 3). Giá bán = Giá vốn / (1 - Biên LN gộp mục tiêu)." />
      {manage && (
        <Card title="Thêm mã hàng" className="mb-6">
          <ActionForm action={saveProduct.bind(null, null)} submitLabel="Thêm" size="sm">
            <ProductFields />
          </ActionForm>
        </Card>
      )}
      <Card>
        <form method="get" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_16rem_auto]">
          <Input name="q" defaultValue={sp.q} placeholder="Tìm theo mã, tên" />
          <Select name="group" defaultValue={sp.group ?? ''} placeholder="Mọi nhóm" options={Object.entries(PRODUCT_GROUPS).map(([value, label]) => ({ value, label: `${value} - ${label}` }))} />
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">Lọc</button>
        </form>
        {products.length === 0 ? (
          <EmptyState title="Chưa có mã hàng">Thêm mã hàng theo quy tắc trong file 04.3: CX cây xanh, CC cây chậu, CB cỏ - cây bụi, CH chậu, VT vật tư.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Mã</Th><Th>Tên hàng, quy cách</Th><Th>ĐVT</Th><Th className="text-right">Giá vốn BQ</Th><Th className="text-right">Giá bán chuẩn</Th><Th className="text-right">Biên LN gộp</Th><Th className="text-right">Giá thuê/tháng</Th><Th /></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                  <Td className="num whitespace-nowrap font-semibold">{p.code}</Td>
                  <Td>{p.name}{p.spec && <div className="text-xs text-muted">{p.spec}</div>}<div className="text-xs text-muted">{PRODUCT_GROUPS[p.group] ?? p.group}{!p.active && ' · Ngừng sử dụng'}</div></Td>
                  <Td>{p.unit}</Td>
                  <Td className="num text-right">{formatVnd(p.costPrice)}</Td>
                  <Td className="num text-right font-medium">{formatVnd(p.listPrice)}</Td>
                  <Td className="num text-right">{p.listPrice > 0 ? formatPercent(grossMarginPercent(p.listPrice, p.costPrice)) : '-'}</Td>
                  <Td className="num text-right">{p.rentPrice ? formatVnd(p.rentPrice) : '-'}</Td>
                  <Td>{manage && <Link href={`/danh-muc/hang-hoa/${p.id}`} className="text-sm font-semibold text-brand hover:underline">Sửa</Link>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {products.some((p) => p.note?.includes('mẫu')) && <p className="mt-3"><Badge tone="amber">Có mã hàng mẫu từ file 04.3, cần thay bằng danh mục thật</Badge></p>}
      </Card>
    </>
  )
}
