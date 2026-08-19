import type { Prisma } from "@/generated/prisma/client";

/**
 * Hands out the next document number for a prefix, e.g. SVI_0001.
 *
 * The UPDATE takes a row lock that is held until the surrounding transaction
 * commits, so two concurrent voucher creations cannot receive the same number,
 * and a rollback returns the number to the pool rather than leaving a gap.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  const sequence = await tx.numberSequence.upsert({
    where: { prefix },
    create: { prefix, lastNo: 1 },
    update: { lastNo: { increment: 1 } },
  });

  return `${prefix}_${String(sequence.lastNo).padStart(4, "0")}`;
}
