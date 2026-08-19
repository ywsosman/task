import { handleError, ok, toNumber } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** The stock ledger. Qty is signed: positive inbound, negative outbound. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const storeId = url.searchParams.get("storeId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);

    const movements = await prisma.stockMovement.findMany({
      where: {
        productId: productId ? Number(productId) : undefined,
        storeId: storeId ? Number(storeId) : undefined,
      },
      include: { product: true, store: true, header: true },
      orderBy: { txId: "desc" },
      take: limit,
    });

    return ok(
      movements.map((movement) => ({
        txId: movement.txId,
        ref: movement.ref,
        transferRef: movement.header.transferRef,
        productId: movement.productId,
        sku: movement.product.sku,
        productName: movement.product.nameEn,
        storeId: movement.storeId,
        store: movement.store.store,
        storeName: movement.store.name,
        qty: movement.qty,
        cost: toNumber(movement.cost),
        value: movement.qty * toNumber(movement.cost),
        createdAt: movement.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return handleError(error);
  }
}
