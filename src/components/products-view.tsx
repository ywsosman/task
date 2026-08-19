"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Banner, Button, Card, EmptyState } from "@/components/ui";
import { StockDialog, type StockAction, type StockDialogTarget } from "@/components/stock-dialog";
import { formatMoney, get, type Balance, type Product, type Warehouse } from "@/lib/client";

export function ProductsView() {
  const { data: products, error: productsError } = useSWR<Product[]>("/api/products", get);
  const { data: warehouses } = useSWR<Warehouse[]>("/api/warehouses", get);
  const { mutate } = useSWRConfig();

  const [expanded, setExpanded] = useState<number | null>(null);
  const [dialog, setDialog] = useState<StockDialogTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDone(text: string) {
    setDialog(null);
    setMessage(text);
    // Balances, product totals and the ledger all shift when a voucher posts.
    await mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/api/products") ||
          key.startsWith("/api/movements") ||
          key.startsWith("/api/vouchers")),
    );
  }

  if (productsError) {
    return <Banner tone="error">Could not load products. Is the database running?</Banner>;
  }

  if (!products || !warehouses) {
    return <EmptyState>Loading...</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {message && <Banner tone="success">{message}</Banner>}

      <Card title="Products" description="Expand a product to see its stock in each warehouse.">
        {products.length === 0 ? (
          <EmptyState>No products yet. Create one from the Setup page.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Name (EN)</th>
                  <th className="py-2 pr-4">Name (AR)</th>
                  <th className="py-2 pr-4">Unit</th>
                  <th className="py-2 pr-4">Group</th>
                  <th className="py-2 pr-4 text-right">Unit Cost</th>
                  <th className="py-2 text-right">Total On Hand</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    warehouses={warehouses}
                    isExpanded={expanded === product.id}
                    onToggle={() => setExpanded(expanded === product.id ? null : product.id)}
                    onAction={(action, balance) => {
                      setMessage(null);
                      setDialog({ action, product, balance });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog && (
        <StockDialog
          target={dialog}
          warehouses={warehouses}
          onClose={() => setDialog(null)}
          onDone={(text) => void handleDone(text)}
        />
      )}
    </div>
  );
}

function ProductRow({
  product,
  warehouses,
  isExpanded,
  onToggle,
  onAction,
}: {
  product: Product;
  warehouses: Warehouse[];
  isExpanded: boolean;
  onToggle: () => void;
  onAction: (action: StockAction, balance: Balance) => void;
}) {
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
          >
            {isExpanded ? "-" : "+"}
          </button>
        </td>
        <td className="py-2 pr-4 font-mono text-xs">{product.sku}</td>
        <td className="py-2 pr-4 font-medium">{product.nameEn}</td>
        <td className="py-2 pr-4" dir="rtl">
          {product.nameAr}
        </td>
        <td className="py-2 pr-4 text-gray-600">{product.unit.code}</td>
        <td className="py-2 pr-4 text-gray-600">{product.group.code}</td>
        <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(product.unitCost)}</td>
        <td className="py-2 text-right font-medium tabular-nums">{product.onHandQty}</td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50/70">
          <td />
          <td colSpan={7} className="py-3 pr-4">
            <BalancesPanel
              productId={product.id}
              warehouseCount={warehouses.length}
              onAction={onAction}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function BalancesPanel({
  productId,
  warehouseCount,
  onAction,
}: {
  productId: number;
  warehouseCount: number;
  onAction: (action: StockAction, balance: Balance) => void;
}) {
  const { data: balances } = useSWR<Balance[]>(`/api/products/${productId}/balances`, get);

  if (!balances) return <p className="text-sm text-gray-500">Loading warehouses...</p>;

  if (balances.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No warehouses yet. Create one from the Setup page.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-1 pr-4">Warehouse</th>
          <th className="py-1 pr-4 text-right">Qty</th>
          <th className="py-1 pr-4 text-right">Avg Cost</th>
          <th className="py-1 pr-4 text-right">Value</th>
          <th className="py-1 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {balances.map((balance) => (
          <tr key={balance.storeId} className="border-t border-gray-200">
            <td className="py-2 pr-4">
              <span className="font-mono text-xs text-gray-500">{balance.store}</span>{" "}
              {balance.storeName}
            </td>
            <td className="py-2 pr-4 text-right font-medium tabular-nums">{balance.qty}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
              {formatMoney(balance.avgCost)}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
              {formatMoney(balance.value)}
            </td>
            <td className="py-2 text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" onClick={() => onAction("ADD", balance)}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  disabled={balance.qty === 0}
                  onClick={() => onAction("REMOVE", balance)}
                >
                  Remove
                </Button>
                <Button
                  variant="ghost"
                  disabled={balance.qty === 0 || warehouseCount < 2}
                  onClick={() => onAction("TRANSFER", balance)}
                >
                  Transfer
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
