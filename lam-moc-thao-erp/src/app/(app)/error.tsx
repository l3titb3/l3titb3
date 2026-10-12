'use client'

import { useEffect } from 'react'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
      <h1 className="text-lg font-bold">Có lỗi khi xử lý</h1>
      <p className="mt-2 text-sm text-muted">{error.message && !error.message.includes('digest') ? error.message : 'Vui lòng thử lại. Nếu lỗi lặp lại, báo cho người quản trị kèm thời điểm xảy ra.'}</p>
      {error.digest && <p className="mt-1 text-xs text-muted">Mã lỗi: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Thử lại</button>
    </div>
  )
}
