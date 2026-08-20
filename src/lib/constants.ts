export const VOUCHER_TYPE = {
  IN: 1,
  OUT: 2,
} as const;

export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

export const SEQUENCE_PREFIX = {
  IN: "SVI",
  OUT: "SVO",
  TRANSFER: "SVT",
} as const;

export const SYSTEM_USER = "system";

export function prefixForType(type: VoucherType) {
  return type === VOUCHER_TYPE.IN ? SEQUENCE_PREFIX.IN : SEQUENCE_PREFIX.OUT;
}

export function voucherTypeLabel(type: number) {
  return type === VOUCHER_TYPE.IN ? "IN" : "OUT";
}
