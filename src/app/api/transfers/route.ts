import { created, handleError, parseJsonBody } from "@/lib/api";
import { createTransferSchema } from "@/lib/validation";
import { serializeVoucher } from "@/server/serializers";
import { createTransfer } from "@/server/voucher-service";

/**
 * Creates a transfer as two linked draft vouchers. Nothing moves until the
 * transfer is posted via /api/transfers/[ref]/post.
 */
export async function POST(request: Request) {
  try {
    const body = createTransferSchema.parse(await parseJsonBody(request));
    const { transferRef, outLeg, inLeg } = await createTransfer(body);

    return created({
      transferRef,
      outLeg: serializeVoucher(outLeg),
      inLeg: serializeVoucher(inLeg),
    });
  } catch (error) {
    return handleError(error);
  }
}
