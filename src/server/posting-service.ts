import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SYSTEM_USER, VOUCHER_TYPE } from "@/lib/constants";
import { InsufficientStockError, InvalidStateError, NotFoundError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

type HeaderWithDetails = Prisma.StoreVoucherHeaderGetPayload<{
  include: { details: true; store: true };
}>;

type BalanceKey = `${number}:${number}`;

type BalanceSnapshot = {
  productId: number;
  storeId: number;
  qty: number;
  avgCost: Prisma.Decimal;
};

const POSTING_TIMEOUT_MS = 20_000;

const OUTBOUND_LEG_FIRST: Prisma.StoreVoucherHeaderOrderByWithRelationInput = { type: "desc" };

const balanceKey = (productId: number, storeId: number): BalanceKey =>
  `${productId}:${storeId}`;

const weightedAverage = (
  currentQty: number,
  currentCost: Prisma.Decimal,
  incomingQty: number,
  incomingCost: Prisma.Decimal,
) =>
  currentQty > 0
    ? currentCost
        .mul(currentQty)
        .add(incomingCost.mul(incomingQty))
        .div(currentQty + incomingQty)
    : incomingCost;

export async function postVoucher(txNo: string, actor: string = SYSTEM_USER) {
  return prisma.$transaction(
    async (tx) => {
      const header = await tx.storeVoucherHeader.findUnique({
        where: { txNo },
        include: { details: true, store: true },
      });
      if (!header) {
        throw new NotFoundError(`Voucher ${txNo} was not found.`);
      }

      const legs = header.transferRef
        ? await tx.storeVoucherHeader.findMany({
            where: { transferRef: header.transferRef },
            include: { details: true, store: true },
            orderBy: OUTBOUND_LEG_FIRST,
          })
        : [header];

      for (const leg of legs) {
        if (leg.status === "POSTED") {
          throw new InvalidStateError(`Voucher ${leg.txNo} is already posted.`);
        }
        if (leg.details.length === 0) {
          throw new InvalidStateError(`Voucher ${leg.txNo} has no lines to post.`);
        }
      }

      const balances = await lockBalancesInStableOrder(tx, legs);
      const outboundCostByProduct = new Map<number, Prisma.Decimal>();
      const posted: string[] = [];

      for (const leg of legs) {
        await applyLeg(tx, leg, balances, outboundCostByProduct, actor);
        posted.push(leg.txNo);
      }

      return { posted, transferRef: header.transferRef };
    },
    { timeout: POSTING_TIMEOUT_MS },
  );
}

async function lockBalancesInStableOrder(tx: Tx, legs: HeaderWithDetails[]) {
  const keys = new Map<BalanceKey, { productId: number; storeId: number }>();
  for (const leg of legs) {
    for (const line of leg.details) {
      keys.set(balanceKey(line.productId, leg.storeId), {
        productId: line.productId,
        storeId: leg.storeId,
      });
    }
  }

  const ordered = [...keys.values()].sort(
    (a, b) => a.productId - b.productId || a.storeId - b.storeId,
  );

  const snapshots = new Map<BalanceKey, BalanceSnapshot>();
  for (const { productId, storeId } of ordered) {
    await tx.$executeRaw`
      INSERT INTO "StockBalance" ("productId", "storeId", "qty", "avgCost", "updatedAt")
      VALUES (${productId}, ${storeId}, 0, 0, NOW())
      ON CONFLICT ("productId", "storeId") DO NOTHING
    `;

    const [row] = await tx.$queryRaw<
      Array<{ qty: number | string; avgCost: string | number }>
    >`
      SELECT "productId", "storeId", "qty", "avgCost"
      FROM "StockBalance"
      WHERE "productId" = ${productId} AND "storeId" = ${storeId}
      FOR UPDATE
    `;

    snapshots.set(balanceKey(productId, storeId), {
      productId,
      storeId,
      qty: Number(row.qty),
      avgCost: new Prisma.Decimal(row.avgCost.toString()),
    });
  }

  return snapshots;
}

async function applyLeg(
  tx: Tx,
  leg: HeaderWithDetails,
  balances: Map<BalanceKey, BalanceSnapshot>,
  outboundCostByProduct: Map<number, Prisma.Decimal>,
  actor: string,
) {
  const isInbound = leg.type === VOUCHER_TYPE.IN;
  const productDelta = new Map<number, number>();

  for (const line of leg.details) {
    const balance = balances.get(balanceKey(line.productId, leg.storeId))!;
    const lineCost = new Prisma.Decimal(line.unitCost.toString());

    const effectiveCost = isInbound
      ? (outboundCostByProduct.get(line.productId) ?? lineCost)
      : balance.qty > 0
        ? balance.avgCost
        : lineCost;

    if (isInbound) {
      const newQty = balance.qty + line.qty;
      const newAvgCost = weightedAverage(balance.qty, balance.avgCost, line.qty, effectiveCost);

      await tx.stockBalance.update({
        where: { productId_storeId: { productId: line.productId, storeId: leg.storeId } },
        data: { qty: newQty, avgCost: newAvgCost },
      });

      balance.qty = newQty;
      balance.avgCost = newAvgCost;
    } else {
      const decremented = await tx.stockBalance.updateMany({
        where: {
          productId: line.productId,
          storeId: leg.storeId,
          qty: { gte: line.qty },
        },
        data: { qty: { decrement: line.qty } },
      });

      if (decremented.count === 0) {
        throw await insufficientStock(tx, leg, line.productId, balance.qty, line.qty);
      }

      balance.qty -= line.qty;
      outboundCostByProduct.set(line.productId, effectiveCost);
    }

    const signedQty = isInbound ? line.qty : -line.qty;

    await tx.storeVoucherDetail.update({
      where: { id: line.id },
      data: {
        unitCost: effectiveCost,
        lineTotal: effectiveCost.mul(line.qty),
      },
    });

    await tx.stockMovement.create({
      data: {
        ref: leg.txNo,
        productId: line.productId,
        storeId: leg.storeId,
        qty: signedQty,
        cost: effectiveCost,
      },
    });

    productDelta.set(line.productId, (productDelta.get(line.productId) ?? 0) + signedQty);
  }

  for (const [productId, delta] of productDelta) {
    await tx.product.update({
      where: { id: productId },
      data: { onHandQty: { increment: delta } },
    });
  }

  await tx.storeVoucherHeader.update({
    where: { txNo: leg.txNo },
    data: { status: "POSTED", postedUid: actor, postedDate: new Date() },
  });
}

async function insufficientStock(
  tx: Tx,
  leg: HeaderWithDetails,
  productId: number,
  available: number,
  requested: number,
) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  return new InsufficientStockError(
    `Insufficient stock for ${product?.sku ?? `product ${productId}`} in ${leg.store.name}: ` +
      `on hand ${available}, requested ${requested}.`,
    { productId, storeId: leg.storeId, available, requested },
  );
}
