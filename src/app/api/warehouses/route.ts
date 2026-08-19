import { created, handleError, ok, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createWarehouseSchema } from "@/lib/validation";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({ orderBy: { store: "asc" } });
    return ok(warehouses);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createWarehouseSchema.parse(await parseJsonBody(request));
    const warehouse = await prisma.warehouse.create({ data: body });
    return created(warehouse);
  } catch (error) {
    return handleError(error);
  }
}
