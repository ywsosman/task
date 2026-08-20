import { toNumber } from "@/lib/api";
import { voucherTypeLabel } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

type VoucherWithRelations = Prisma.StoreVoucherHeaderGetPayload<{
  include: { details: { include: { product: true } }; store: true };
}>;

export function serializeVoucher(voucher: VoucherWithRelations) {
  return {
    txNo: voucher.txNo,
    type: voucher.type,
    typeLabel: voucherTypeLabel(voucher.type),
    status: voucher.status,
    date: voucher.date.toISOString(),
    note: voucher.note,
    transferRef: voucher.transferRef,
    insertUid: voucher.insertUid,
    insertDate: voucher.insertDate.toISOString(),
    postedUid: voucher.postedUid,
    postedDate: voucher.postedDate?.toISOString() ?? null,
    store: {
      id: voucher.store.id,
      store: voucher.store.store,
      name: voucher.store.name,
    },
    lines: voucher.details.map((detail) => ({
      id: detail.id,
      productId: detail.productId,
      sku: detail.product.sku,
      productName: detail.product.nameEn,
      qty: detail.qty,
      unitCost: toNumber(detail.unitCost),
      lineTotal: toNumber(detail.lineTotal),
    })),
    total: voucher.details.reduce((sum, detail) => sum + toNumber(detail.lineTotal), 0),
  };
}

export type SerializedVoucher = ReturnType<typeof serializeVoucher>;
