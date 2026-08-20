"use client";

import { useState } from "react";
import { Banner, Button, Field, Input, Modal, Select } from "@/components/ui";
import { ApiError, post, type Balance, type Product, type Warehouse } from "@/lib/client";

export type StockAction = "ADD" | "REMOVE" | "TRANSFER";

export type StockDialogTarget = {
  action: StockAction;
  product: Product;
  balance: Balance;
};

const titles: Record<StockAction, string> = {
  ADD: "Add Stock",
  REMOVE: "Remove Stock",
  TRANSFER: "Transfer Stock",
};

export function StockDialog({
  target,
  warehouses,
  onClose,
  onDone,
}: {
  target: StockDialogTarget;
  warehouses: Warehouse[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { action, product, balance } = target;

  const otherStores = warehouses.filter((warehouse) => warehouse.id !== balance.storeId);
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState(String(product.unitCost));
  const [toStoreId, setToStoreId] = useState(otherStores[0]?.id ?? 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(shouldPost: boolean) {
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (action === "TRANSFER" && !toStoreId) {
      setError("Choose a destination warehouse.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (action === "TRANSFER") {
        const draft = await post<{ transferRef: string }>("/api/transfers", {
          fromStoreId: balance.storeId,
          toStoreId,
          note: note || undefined,
          lines: [{ productId: product.id, qty: quantity }],
        });

        if (shouldPost) {
          await post(`/api/transfers/${draft.transferRef}/post`);
          onDone(`Transfer ${draft.transferRef} posted.`);
        } else {
          onDone(`Transfer ${draft.transferRef} saved as draft.`);
        }
        return;
      }

      const draft = await post<{ txNo: string }>("/api/vouchers", {
        storeId: balance.storeId,
        type: action === "ADD" ? 1 : 2,
        note: note || undefined,
        lines: [
          {
            productId: product.id,
            qty: quantity,
            ...(action === "ADD" ? { unitCost: Number(unitCost) || 0 } : {}),
          },
        ],
      });

      if (shouldPost) {
        await post(`/api/vouchers/${draft.txNo}/post`);
        onDone(`Voucher ${draft.txNo} posted.`);
      } else {
        onDone(`Voucher ${draft.txNo} saved as draft.`);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={titles[action]} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
          <p className="font-medium">
            {product.sku} - {product.nameEn}
          </p>
          <p className="text-gray-600">
            {action === "TRANSFER" ? "From" : "Warehouse"}: {balance.storeName} - on hand{" "}
            {balance.qty} {product.unit.code}
          </p>
        </div>

        {action === "TRANSFER" && (
          <Field label="To warehouse">
            <Select
              value={toStoreId}
              onChange={(event) => setToStoreId(Number(event.target.value))}
            >
              {otherStores.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.store} - {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Quantity">
          <Input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>

        {action === "ADD" && (
          <Field label="Unit cost" hint="Blends into the warehouse average cost when posted.">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
            />
          </Field>
        )}

        {action !== "ADD" && (
          <p className="text-xs text-gray-500">
            Valued at the warehouse average cost of {balance.avgCost.toFixed(2)} when posted.
          </p>
        )}

        <Field label="Note (optional)">
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" disabled={busy} onClick={() => submit(false)}>
            Save as Draft
          </Button>
          <Button disabled={busy} onClick={() => submit(true)}>
            {busy ? "Working..." : "Save and Post"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
