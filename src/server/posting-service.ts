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

const balanceKey = (productId: number, storeId: number): BalanceKey =>
  `${productId}:${storeId}`;

/**
 * Posts a voucher. This is the only operation that touches stock.
 *
 * Everything runs inside a single interactive transaction: if any line fails,
 * no balance, ledger row or status change survives. When the voucher belongs to
 * a transfer, both legs are posted here together, which is what guarantees the
 * two warehouses move as one atomic unit.
 */
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
            // Post the outbound leg first so the inbound leg can be valued at
            // the cost the goods actually left the source store with.
            orderBy: { type: "desc" },
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

      const balances = await lockBalances(tx, legs);

      // Carries the outbound cost of a transfer across to its inbound leg.
      const transferCost = new Map<number, Prisma.Decimal>();
      const posted: string[] = [];

      for (const leg of legs) {
        await applyLeg(tx, leg, balances, transferCost, actor);
        posted.push(leg.txNo);
      }

      return { posted, transferRef: header.transferRef };
    },
    { timeout: 20_000 },
  );
}

/**
 * Takes row locks on every balance the posting will touch, in a stable order.
 *
 * Locking up front serves two purposes: the average-cost calculation can then
 * read a snapshot that nobody else can change mid-transaction, and the fixed
 * ordering keeps two concurrent transfers between the same stores from
 * deadlocking against each other.
 */
async function lockBalances(tx: Tx, legs: HeaderWithDetails[]) {
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
    // ON CONFLICT DO NOTHING rather than an upsert, so two concurrent postings
    // racing to create the same balance row cannot collide on the unique index.
    await tx.$executeRaw`
      INSERT INTO "StockBalance" ("productId", "storeId", "qty", "avgCost", "updatedAt")
      VALUES (${productId}, ${storeId}, 0, 0, NOW())
      ON CONFLICT ("productId", "storeId") DO NOTHING
    `;

    // The driver returns numeric columns as strings, hence the normalising below.
    const rows = await tx.$queryRaw<
      Array<{ qty: number | string; avgCost: string | number }>
    >`
      SELECT "productId", "storeId", "qty", "avgCost"
      FROM "StockBalance"
      WHERE "productId" = ${productId} AND "storeId" = ${storeId}
      FOR UPDATE
    `;

    const row = rows[0];
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
  transferCost: Map<number, Prisma.Decimal>,
  actor: string,
) {
  const isInbound = leg.type === VOUCHER_TYPE.IN;
  const productDelta = new Map<number, number>();

  for (const line of leg.details) {
    const key = balanceKey(line.productId, leg.storeId);
    const balance = balances.get(key)!;

    const effectiveCost = isInbound
      ? // A transfer's inbound leg inherits the source store's cost so that
        // inventory value travels with the goods.
        (transferCost.get(line.productId) ?? new Prisma.Decimal(line.unitCost.toString()))
      : balance.qty > 0
        ? balance.avgCost
        : new Prisma.Decimal(line.unitCost.toString());

    if (isInbound) {
      const newQty = balance.qty + line.qty;
      // Weighted moving average: existing value plus incoming value, spread
      // over the new quantity.
      const newAvgCost =
        balance.qty > 0
          ? balance.avgCost
              .mul(balance.qty)
              .add(effectiveCost.mul(line.qty))
              .div(newQty)
          : effectiveCost;

      await tx.stockBalance.update({
        where: { productId_storeId: { productId: line.productId, storeId: leg.storeId } },
        data: { qty: newQty, avgCost: newAvgCost },
      });

      balance.qty = newQty;
      balance.avgCost = newAvgCost;
    } else {
      // Guarded update: the quantity condition lives in the WHERE clause, so
      // the check and the write are a single statement and stock can never be
      // driven below zero.
      const result = await tx.stockBalance.updateMany({
        where: {
          productId: line.productId,
          storeId: leg.storeId,
          qty: { gte: line.qty },
        },
        data: { qty: { decrement: line.qty } },
      });

      if (result.count === 0) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        throw new InsufficientStockError(
          `Insufficient stock for ${product?.sku ?? `product ${line.productId}`} in ${leg.store.name}: ` +
            `on hand ${balance.qty}, requested ${line.qty}.`,
          { productId: line.productId, storeId: leg.storeId, available: balance.qty, requested: line.qty },
        );
      }

      // Issuing at average cost leaves the average itself unchanged.
      balance.qty -= line.qty;
      transferCost.set(line.productId, effectiveCost);
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
