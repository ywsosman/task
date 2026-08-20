import { handleError, ok, toNumber } from "@/lib/api";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError("Product id must be a positive integer.");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError(`Product ${productId} was not found.`);
    }

    const [warehouses, balances] = await Promise.all([
      prisma.warehouse.findMany({ orderBy: { store: "asc" } }),
      prisma.stockBalance.findMany({ where: { productId } }),
    ]);

    return ok(
      warehouses.map((warehouse) => {
        const balance = balances.find((candidate) => candidate.storeId === warehouse.id);
        return {
          storeId: warehouse.id,
          store: warehouse.store,
          storeName: warehouse.name,
          qty: balance?.qty ?? 0,
          avgCost: toNumber(balance?.avgCost),
          value: (balance?.qty ?? 0) * toNumber(balance?.avgCost),
        };
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
