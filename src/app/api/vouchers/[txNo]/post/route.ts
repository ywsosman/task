import { handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeVoucher } from "@/server/serializers";
import { postVoucher } from "@/server/posting-service";

export async function POST(_request: Request, context: { params: Promise<{ txNo: string }> }) {
  try {
    const { txNo } = await context.params;
    const result = await postVoucher(txNo);

    const vouchers = await prisma.storeVoucherHeader.findMany({
      where: { txNo: { in: result.posted } },
      include: { details: { include: { product: true } }, store: true },
    });

    return ok({
      posted: result.posted,
      transferRef: result.transferRef,
      vouchers: vouchers.map(serializeVoucher),
    });
  } catch (error) {
    return handleError(error);
  }
}
