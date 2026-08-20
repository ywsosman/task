export type Group = { id: number; code: string; name: string };
export type Unit = { id: number; code: string; name: string };
export type Warehouse = { id: number; store: string; name: string };

export type Product = {
  id: number;
  sku: string;
  nameEn: string;
  nameAr: string;
  unitCost: number;
  onHandQty: number;
  unit: Unit;
  group: Group;
};

export type Balance = {
  storeId: number;
  store: string;
  storeName: string;
  qty: number;
  avgCost: number;
  value: number;
};

export type VoucherLine = {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type Voucher = {
  txNo: string;
  type: number;
  typeLabel: string;
  status: "DRAFT" | "POSTED";
  date: string;
  note: string | null;
  transferRef: string | null;
  insertUid: string;
  insertDate: string;
  postedUid: string | null;
  postedDate: string | null;
  store: Warehouse;
  lines: VoucherLine[];
  total: number;
};

export type Movement = {
  txId: number;
  ref: string;
  transferRef: string | null;
  productId: number;
  sku: string;
  productName: string;
  storeId: number;
  store: string;
  storeName: string;
  qty: number;
  cost: number;
  value: number;
  createdAt: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? "Request failed.",
      payload?.error?.code ?? "INTERNAL_ERROR",
      response.status,
    );
  }

  return payload as T;
}

export const get = <T,>(path: string) => api<T>(path, { cache: "no-store" });

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const del = <T,>(path: string) => api<T>(path, { method: "DELETE" });

export const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDateTime = (value: string) => new Date(value).toLocaleString();
