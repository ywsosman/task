import { created, handleError, ok, parseJsonBody, toNumber } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createProductSchema } from "@/lib/validation";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { sku: "asc" },
      include: { unit: true, group: true },
    });

    return ok(
      products.map((product) => ({
        id: product.id,
        sku: product.sku,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        unitCost: toNumber(product.unitCost),
        onHandQty: product.onHandQty,
        unit: { id: product.unit.id, code: product.unit.code, name: product.unit.name },
        group: { id: product.group.id, code: product.group.code, name: product.group.name },
      })),
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createProductSchema.parse(await parseJsonBody(request));
    const product = await prisma.product.create({
      data: body,
      include: { unit: true, group: true },
    });
    return created({ ...product, unitCost: toNumber(product.unitCost) });
  } catch (error) {
    return handleError(error);
  }
}
