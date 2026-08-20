import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SEQUENCE_PREFIX, SYSTEM_USER, VOUCHER_TYPE, prefixForType } from "@/lib/constants";
import { InvalidStateError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CreateTransferInput, CreateVoucherInput } from "@/lib/validation";
import { nextDocumentNumber } from "./sequence";

type Tx = Prisma.TransactionClient;

const voucherInclude = {
  details: { include: { product: true } },
  store: true,
} satisfies Prisma.StoreVoucherHeaderInclude;

export async function createVoucher(input: CreateVoucherInput, actor: string = SYSTEM_USER) {
  return prisma.$transaction(async (tx) => {
    const store = await tx.warehouse.findUnique({ where: { id: input.storeId } });
    if (!store) {
      throw new NotFoundError(`Warehouse ${input.storeId} was not found.`);
    }

    const lines = await resolveLineCosts(tx, input.lines, input.storeId, input.type);
    const txNo = await nextDocumentNumber(tx, prefixForType(input.type));

    return tx.storeVoucherHeader.create({
      data: {
        txNo,
        storeId: input.storeId,
        type: input.type,
        date: input.date ? new Date(input.date) : new Date(),
        note: input.note,
        insertUid: actor,
        details: { create: lines },
      },
      include: voucherInclude,
    });
  });
}

export async function createTransfer(input: CreateTransferInput, actor: string = SYSTEM_USER) {
  return prisma.$transaction(async (tx) => {
    const [fromStore, toStore] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: input.fromStoreId } }),
      tx.warehouse.findUnique({ where: { id: input.toStoreId } }),
    ]);
    if (!fromStore) throw new NotFoundError(`Source warehouse ${input.fromStoreId} was not found.`);
    if (!toStore) throw new NotFoundError(`Destination warehouse ${input.toStoreId} was not found.`);

    const transferRef = await nextDocumentNumber(tx, SEQUENCE_PREFIX.TRANSFER);
    const outTxNo = await nextDocumentNumber(tx, SEQUENCE_PREFIX.OUT);
    const inTxNo = await nextDocumentNumber(tx, SEQUENCE_PREFIX.IN);

    const date = input.date ? new Date(input.date) : new Date();
    const note = input.note ?? `Transfer ${fromStore.name} -> ${toStore.name}`;
    const lines = await resolveLineCosts(tx, input.lines, input.fromStoreId, VOUCHER_TYPE.OUT);

    const outLeg = await tx.storeVoucherHeader.create({
      data: {
        txNo: outTxNo,
        storeId: input.fromStoreId,
        type: VOUCHER_TYPE.OUT,
        date,
        note,
        transferRef,
        insertUid: actor,
        details: { create: lines },
      },
      include: voucherInclude,
    });

    const inLeg = await tx.storeVoucherHeader.create({
      data: {
        txNo: inTxNo,
        storeId: input.toStoreId,
        type: VOUCHER_TYPE.IN,
        date,
        note,
        transferRef,
        insertUid: actor,
        details: { create: lines },
      },
      include: voucherInclude,
    });

    return { transferRef, outLeg, inLeg };
  });
}

export async function deleteDraftVoucher(txNo: string) {
  const header = await prisma.storeVoucherHeader.findUnique({ where: { txNo } });
  if (!header) throw new NotFoundError(`Voucher ${txNo} was not found.`);
  if (header.status === "POSTED") {
    throw new InvalidStateError(
      `Voucher ${txNo} is posted and cannot be deleted. Post a reversing voucher instead.`,
    );
  }

  if (header.transferRef) {
    await prisma.storeVoucherHeader.deleteMany({
      where: { transferRef: header.transferRef, status: "DRAFT" },
    });
    return { deleted: header.transferRef };
  }

  await prisma.storeVoucherHeader.delete({ where: { txNo } });
  return { deleted: txNo };
}

async function resolveLineCosts(
  tx: Tx,
  lines: Array<{ productId: number; qty: number; unitCost?: number }>,
  storeId: number,
  type: number,
) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });

  const missing = productIds.filter((id) => !products.some((product) => product.id === id));
  if (missing.length > 0) {
    throw new NotFoundError(`Product(s) not found: ${missing.join(", ")}.`);
  }

  const balances = await tx.stockBalance.findMany({
    where: { storeId, productId: { in: productIds } },
  });

  return lines.map((line) => {
    if (line.qty <= 0) {
      throw new ValidationError("Quantity must be greater than zero.");
    }

    const product = products.find((candidate) => candidate.id === line.productId)!;
    const balance = balances.find((candidate) => candidate.productId === line.productId);

    let unitCost: Prisma.Decimal;
    if (line.unitCost !== undefined) {
      unitCost = new Prisma.Decimal(line.unitCost);
    } else if (type === VOUCHER_TYPE.OUT && balance && balance.qty > 0) {
      unitCost = balance.avgCost;
    } else {
      unitCost = product.unitCost;
    }

    return {
      productId: line.productId,
      qty: line.qty,
      unitCost,
      lineTotal: unitCost.mul(line.qty),
    };
  });
}
