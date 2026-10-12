import type { Prisma } from '@prisma/client'
import { prisma } from './db'

type Db = Prisma.TransactionClient | typeof prisma

export async function audit(
  db: Db,
  input: { userId: string; action: string; entity: string; entityId: string; detail?: string },
): Promise<void> {
  await db.auditLog.create({ data: input })
}
