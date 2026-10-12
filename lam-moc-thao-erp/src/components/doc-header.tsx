import type { ReactNode } from 'react'

/** Phần đầu văn bản theo thể thức các biểu mẫu của công ty */
export function DocHeader({ company, number, place = 'Khánh Hòa', date }: { company: string; number?: string; place?: string; date: Date }) {
  return (
    <table className="mb-4 w-full">
      <tbody>
        <tr className="align-top">
          <td className="w-[42%] text-center">
            <div className="font-bold uppercase">{company}</div>
            <div className="mx-auto mt-1 w-24 border-t border-black" />
            {number && <div className="mt-1">Số: {number}</div>}
          </td>
          <td className="text-center">
            <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-bold">Độc lập - Tự do - Hạnh phúc</div>
            <div className="mx-auto mt-1 w-40 border-t border-black" />
            <div className="mt-2 italic">
              {place}, ngày {pad(date.getUTCDate())} tháng {pad(date.getUTCMonth() + 1)} năm {date.getUTCFullYear()}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

export function DocTable({ children }: { children: ReactNode }) {
  return <table className="my-3 w-full border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-black [&_th]:px-2 [&_th]:py-1">{children}</table>
}

export function Signatures({ left, right }: { left?: { title: string; note?: string; name?: string }; right: { title: string; note?: string; name?: string } }) {
  const cell = (s?: { title: string; note?: string; name?: string }) =>
    s ? (
      <td className="w-1/2 text-center align-top">
        <div className="font-bold">{s.title}</div>
        <div className="italic">{s.note ?? '(Ký, ghi rõ họ tên)'}</div>
        <div className="h-24" />
        {s.name && <div className="font-bold">{s.name}</div>}
      </td>
    ) : (
      <td className="w-1/2" />
    )
  return (
    <table className="mt-6 w-full break-inside-avoid">
      <tbody>
        <tr>
          {cell(left)}
          {cell(right)}
        </tr>
      </tbody>
    </table>
  )
}
