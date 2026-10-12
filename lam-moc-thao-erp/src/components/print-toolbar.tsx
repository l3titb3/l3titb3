'use client'

export function PrintToolbar() {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full justify-end gap-2 px-2">
      <button type="button" onClick={() => window.close()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">Đóng</button>
      <button type="button" onClick={() => window.print()} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">In / Lưu PDF</button>
    </div>
  )
}
