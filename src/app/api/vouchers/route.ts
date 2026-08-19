import { created, handleError, ok, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createVoucherSchema } from "@/lib/validation";
import { serializeVoucher } from "@/server/serializers";
import { createVoucher } from "@/server/voucher-service";
import type { VoucherStatus } from "@/generated/prisma/enums";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const storeId = url.searchParams.get("storeId");
    const type = url.searchParams.get("type");

    const vouchers = await prisma.storeVoucherHeader.findMany({
      where: {
        status: status === "DRAFT" || status === "POSTED" ? (status as VoucherStatus) : undefined,
        storeId: storeId ? Number(storeId) : undefined,
        type: type ? Number(type) : undefined,
      },
      include: { details: { include: { product: true } }, store: true },
      orderBy: { insertDate: "desc" },
      take: 100,
    });

    return ok(vouchers.map(serializeVoucher));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createVoucherSchema.parse(await parseJsonBody(request));
    const voucher = await createVoucher(body);
    return created(serializeVoucher(voucher));
  } catch (error) {
    return handleError(error);
  }
}
