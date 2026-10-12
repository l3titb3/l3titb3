import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <h1 className="text-lg font-bold">Không tìm thấy trang hoặc bạn không có quyền xem</h1>
        <p className="mt-2 text-sm text-muted">Bản ghi có thể đã bị xóa, hoặc thuộc khách hàng do người khác phụ trách.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Về trang Tổng quan</Link>
      </div>
    </div>
  )
}
