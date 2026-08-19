import { z } from "zod";
import { VOUCHER_TYPE } from "./constants";

const id = z.number().int().positive();
const qty = z.number().int().positive("Quantity must be a positive whole number.");
const cost = z.number().nonnegative("Cost cannot be negative.");
const code = z.string().trim().min(1).max(20);
const name = z.string().trim().min(1).max(120);

export const createGroupSchema = z.object({ code, name });
export const createUnitSchema = z.object({ code, name });

export const createWarehouseSchema = z.object({
  store: code,
  name,
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(200),
  nameAr: z.string().trim().min(1).max(200),
  unitId: id,
  groupId: id,
  unitCost: cost.default(0),
});

export const voucherLineSchema = z.object({
  productId: id,
  qty,
  unitCost: cost.optional(),
});

export const createVoucherSchema = z.object({
  storeId: id,
  type: z.union([z.literal(VOUCHER_TYPE.IN), z.literal(VOUCHER_TYPE.OUT)]),
  date: z.iso.datetime().optional(),
  note: z.string().trim().max(500).optional(),
  lines: z.array(voucherLineSchema).min(1, "A voucher needs at least one line."),
});

export const createTransferSchema = z
  .object({
    fromStoreId: id,
    toStoreId: id,
    date: z.iso.datetime().optional(),
    note: z.string().trim().max(500).optional(),
    lines: z.array(voucherLineSchema.omit({ unitCost: true })).min(1),
  })
  .refine((value) => value.fromStoreId !== value.toStoreId, {
    message: "Source and destination stores must be different.",
    path: ["toStoreId"],
  });

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
