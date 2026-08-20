import type { Prisma } from "@/generated/prisma/client";

const NUMBER_WIDTH = 4;

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  const sequence = await tx.numberSequence.upsert({
    where: { prefix },
    create: { prefix, lastNo: 1 },
    update: { lastNo: { increment: 1 } },
  });

  return `${prefix}_${String(sequence.lastNo).padStart(NUMBER_WIDTH, "0")}`;
}
