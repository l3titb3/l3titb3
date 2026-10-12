import { requireUser } from '@/lib/auth'
import { PrintToolbar } from '@/components/print-toolbar'

export const dynamic = 'force-dynamic'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div className="min-h-screen bg-zinc-200 py-6 print:bg-white print:py-0">
      <PrintToolbar />
      <div className="mx-auto w-[210mm] max-w-full bg-white px-[18mm] py-[15mm] font-[Times_New_Roman,serif] text-[13.5px] leading-relaxed text-black shadow print:w-auto print:p-0 print:shadow-none">
        {children}
      </div>
      <style>{`@page { size: A4; margin: 15mm 15mm 15mm 20mm; }`}</style>
    </div>
  )
}
