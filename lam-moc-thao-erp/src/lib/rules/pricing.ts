import { roundVnd } from './money'

export type PricedLine = {
  quantity: number
  unitPrice: number
  unitCost: number
}

export type QuoteTotals = {
  subtotal: number
  vatAmount: number
  total: number
  costTotal: number
  /** Biên LN gộp (%) trên tiền hàng chưa VAT */
  grossMargin: number
}

export function lineAmount(line: PricedLine): number {
  return roundVnd(line.quantity * line.unitPrice)
}

export function lineCost(line: PricedLine): number {
  return roundVnd(line.quantity * line.unitCost)
}

export function computeTotals(lines: PricedLine[], vatRate: number): QuoteTotals {
  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0)
  const costTotal = lines.reduce((sum, l) => sum + lineCost(l), 0)
  const vatAmount = roundVnd((subtotal * vatRate) / 100)
  return {
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
    costTotal,
    grossMargin: grossMarginPercent(subtotal, costTotal),
  }
}

export function grossMarginPercent(revenue: number, cost: number): number {
  if (revenue <= 0) return 0
  return Math.round(((revenue - cost) / revenue) * 1000) / 10
}

/** QT-KD-01 mục 3: Giá bán = Giá vốn dự kiến / (1 - Biên lợi nhuận gộp mục tiêu) */
export function priceFromCost(cost: number, targetMarginPercent: number): number {
  if (targetMarginPercent >= 100) throw new Error('Biên lợi nhuận phải nhỏ hơn 100%')
  return roundVnd(cost / (1 - targetMarginPercent / 100))
}
