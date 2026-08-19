"use client";

import { useState } from "react";
import useSWR from "swr";
import { Banner, Card, EmptyState, Select } from "@/components/ui";
import {
  formatDateTime,
  formatMoney,
  get,
  type Movement,
  type Product,
  type Warehouse,
} from "@/lib/client";

export function MovementsView() {
  const [productId, setProductId] = useState("");
  const [storeId, setStoreId] = useState("");

  const { data: products } = useSWR<Product[]>("/api/products", get);
  const { data: warehouses } = useSWR<Warehouse[]>("/api/warehouses", get);

  const params = new URLSearchParams();
  if (productId) params.set("productId", productId);
  if (storeId) params.set("storeId", storeId);
  const query = params.toString();

  const { data: movements, error } = useSWR<Movement[]>(
    `/api/movements${query ? `?${query}` : ""}`,
    get,
  );

  return (
    <div className="space-y-4">
      {error && <Banner tone="error">Could not load movements.</Banner>}

      <Card
        title="Stock Movement Ledger"
        description="Written only when a voucher is posted. Quantity is negative for issues."
        actions={
          <div className="flex gap-2">
            <div className="w-48">
              <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">All products</option>
                {(products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.nameEn}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
                <option value="">All warehouses</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
      >
        {!movements ? (
          <EmptyState>Loading...</EmptyState>
        ) : movements.length === 0 ? (
          <EmptyState>No movements yet. Post a voucher to see entries here.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Tx ID</th>
                  <th className="py-2 pr-4">Ref</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Warehouse</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 pr-4 text-right">Value</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.txId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-500">{movement.txId}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {movement.ref}
                      {movement.transferRef && (
                        <span className="ml-1 text-gray-400">({movement.transferRef})</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{movement.sku}</td>
                    <td className="py-2 pr-4">{movement.productName}</td>
                    <td className="py-2 pr-4">{movement.storeName}</td>
                    <td
                      className={`py-2 pr-4 text-right font-medium tabular-nums ${
                        movement.qty < 0 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {movement.qty > 0 ? `+${movement.qty}` : movement.qty}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
                      {formatMoney(movement.cost)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
                      {formatMoney(movement.value)}
                    </td>
                    <td className="py-2 text-gray-500">{formatDateTime(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
