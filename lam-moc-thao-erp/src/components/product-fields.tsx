import type { Product } from '@prisma/client'
import { Field, Input, Select } from './form'
import { PRODUCT_GROUPS } from '@/lib/labels'

export function ProductFields({ product: p }: { product?: Product }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Mã hàng" required><Input name="code" defaultValue={p?.code} required placeholder="CC-KT35" /></Field>
      <Field label="Tên hàng" required className="lg:col-span-2"><Input name="name" defaultValue={p?.name} required /></Field>
      <Field label="Nhóm" required><Select name="group" defaultValue={p?.group ?? 'CC'} options={Object.entries(PRODUCT_GROUPS).map(([value, label]) => ({ value, label: `${value} - ${label}` }))} /></Field>
      <Field label="Quy cách"><Input name="spec" defaultValue={p?.spec ?? ''} placeholder="H 0,8-1,0 m; chậu sứ 35" /></Field>
      <Field label="ĐVT" required><Input name="unit" defaultValue={p?.unit} required placeholder="Chậu, Cây, m2..." /></Field>
      <Field label="Giá vốn bình quân"><Input name="costPrice" defaultValue={p?.costPrice ?? ''} inputMode="numeric" /></Field>
      <Field label="Giá bán chuẩn"><Input name="listPrice" defaultValue={p?.listPrice ?? ''} inputMode="numeric" /></Field>
      <Field label="Giá cho thuê/tháng"><Input name="rentPrice" defaultValue={p?.rentPrice ?? ''} inputMode="numeric" /></Field>
      <Field label="Tồn tối thiểu"><Input name="minStock" defaultValue={p?.minStock ?? ''} inputMode="numeric" /></Field>
      <Field label="Ghi chú" className="lg:col-span-2"><Input name="note" defaultValue={p?.note ?? ''} /></Field>
    </div>
  )
}
