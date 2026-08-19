import { handleError, ok } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { serializeVoucher } from "@/server/serializers";
import { deleteDraftVoucher } from "@/server/voucher-service";

export async function GET(_request: Request, context: { params: Promise<{ txNo: string }> }) {
  try {
    const { txNo } = await context.params;
    const voucher = await prisma.storeVoucherHeader.findUnique({
      where: { txNo },
      include: { details: { include: { product: true } }, store: true },
    });
    if (!voucher) throw new NotFoundError(`Voucher ${txNo} was not found.`);
    return ok(serializeVoucher(voucher));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ txNo: string }> }) {
  try {
    const { txNo } = await context.params;
    return ok(await deleteDraftVoucher(txNo));
  } catch (error) {
    return handleError(error);
  }
}
