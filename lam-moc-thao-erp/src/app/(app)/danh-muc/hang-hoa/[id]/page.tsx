import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox } from '@/components/form'
import { ProductFields } from '@/components/product-fields'
import { saveProduct } from '../../actions'

export const metadata = { title: 'Sửa mã hàng' }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  if (!can.manageProducts(user)) redirect('/danh-muc/hang-hoa')
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) notFound()
  return (
    <>
      <PageHeader title={`Sửa ${product.code}`} back={{ href: '/danh-muc/hang-hoa', label: 'Hàng hóa - dịch vụ' }} />
      <Card>
        <ActionForm action={saveProduct.bind(null, id)} submitLabel="Lưu">
          <ProductFields product={product} />
          <Checkbox name="active" label="Đang sử dụng (bỏ chọn để ngừng, không xóa vì đã có báo giá dùng mã này)" defaultChecked={product.active} />
        </ActionForm>
      </Card>
    </>
  )
}
