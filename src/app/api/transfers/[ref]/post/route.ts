import { handleError, ok } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeVoucher } from "@/server/serializers";
import { postVoucher } from "@/server/posting-service";

/** Posts both legs of a transfer atomically. */
export async function POST(_request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await context.params;

    const legs = await prisma.storeVoucherHeader.findMany({
      where: { transferRef: ref },
      orderBy: { type: "desc" },
    });
    if (legs.length === 0) {
      throw new NotFoundError(`Transfer ${ref} was not found.`);
    }

    const result = await postVoucher(legs[0].txNo);

    const vouchers = await prisma.storeVoucherHeader.findMany({
      where: { txNo: { in: result.posted } },
      include: { details: { include: { product: true } }, store: true },
    });

    return ok({
      transferRef: ref,
      posted: result.posted,
      vouchers: vouchers.map(serializeVoucher),
    });
  } catch (error) {
    return handleError(error);
  }
}
