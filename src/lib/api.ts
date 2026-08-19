import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Every route funnels failures through here so the client always sees
 * { error: { code, message, details? } }.
 */
export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body failed validation.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (isPrismaError(error, "P2002")) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "A record with that unique value already exists." } },
      { status: 409 },
    );
  }

  if (isPrismaError(error, "P2003")) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Referenced record does not exist." } },
      { status: 400 },
    );
  }

  // Two reciprocal transfers posting at the same time can deadlock; Postgres
  // aborts one and the client is safe to retry.
  if (isPrismaError(error, "P2034")) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "The operation conflicted with another transaction. Please retry.",
        },
      },
      { status: 409 },
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
    { status: 500 },
  );
}

function isPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/** Prisma returns Decimal objects; the UI is easier to write against numbers. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  }
}
