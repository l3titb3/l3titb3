import type { Prisma } from '@prisma/client'

/** Lấy số thứ tự tiếp theo cho một loại chứng từ. Gọi trong transaction. */
export async function nextSeq(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  })
  return counter.value
}
