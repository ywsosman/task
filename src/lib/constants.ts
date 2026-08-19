/** StoreVoucherHeader.type. Stored as an integer to match the original design. */
export const VOUCHER_TYPE = {
  IN: 1,
  OUT: 2,
} as const;

export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

/** Document number prefixes handed out by the NumberSequence table. */
export const SEQUENCE_PREFIX = {
  IN: "SVI",
  OUT: "SVO",
  TRANSFER: "SVT",
} as const;

export function prefixForType(type: VoucherType) {
  return type === VOUCHER_TYPE.IN ? SEQUENCE_PREFIX.IN : SEQUENCE_PREFIX.OUT;
}

export function voucherTypeLabel(type: number) {
  return type === VOUCHER_TYPE.IN ? "IN" : "OUT";
}

/**
 * Authentication is out of scope for this assignment, so every document is
 * stamped with a fixed user. The columns are ready for real users later.
 */
export const SYSTEM_USER = "system";
