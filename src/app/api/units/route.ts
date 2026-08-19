import { created, handleError, ok, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createUnitSchema } from "@/lib/validation";

export async function GET() {
  try {
    const units = await prisma.unit.findMany({ orderBy: { code: "asc" } });
    return ok(units);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createUnitSchema.parse(await parseJsonBody(request));
    const unit = await prisma.unit.create({ data: body });
    return created(unit);
  } catch (error) {
    return handleError(error);
  }
}
