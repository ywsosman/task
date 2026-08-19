export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STATE"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

/** Raised when a posting would drive a store balance below zero. */
export class InsufficientStockError extends AppError {
  constructor(message: string, details?: unknown) {
    super("INSUFFICIENT_STOCK", message, 409, details);
  }
}

/** Raised on an illegal document transition, e.g. posting a posted voucher. */
export class InvalidStateError extends AppError {
  constructor(message: string) {
    super("INVALID_STATE", message, 409);
  }
}
