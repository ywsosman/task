import { created, handleError, ok, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/validation";

export async function GET() {
  try {
    const groups = await prisma.group.findMany({ orderBy: { code: "asc" } });
    return ok(groups);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createGroupSchema.parse(await parseJsonBody(request));
    const group = await prisma.group.create({ data: body });
    return created(group);
  } catch (error) {
    return handleError(error);
  }
}
