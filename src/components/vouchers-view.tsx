"use client";

import { Fragment, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Banner, Button, Card, EmptyState, Select, StatusBadge } from "@/components/ui";
import { ApiError, del, formatDateTime, formatMoney, get, post, type Voucher } from "@/lib/client";

export function VouchersView() {
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const key = `/api/vouchers${status ? `?status=${status}` : ""}`;
  const { data: vouchers, error: loadError } = useSWR<Voucher[]>(key, get);
  const { mutate } = useSWRConfig();

  const refresh = () =>
    mutate(
      (cacheKey) =>
        typeof cacheKey === "string" &&
        (cacheKey.startsWith("/api/vouchers") ||
          cacheKey.startsWith("/api/products") ||
          cacheKey.startsWith("/api/movements")),
    );

  async function run(txNo: string, action: () => Promise<string>) {
    setBusy(txNo);
    setMessage(null);
    setError(null);
    try {
      setMessage(await action());
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const postVoucher = (voucher: Voucher) =>
    run(voucher.txNo, async () => {
      const path = voucher.transferRef
        ? `/api/transfers/${voucher.transferRef}/post`
        : `/api/vouchers/${voucher.txNo}/post`;
      const result = await post<{ posted: string[] }>(path);
      return `Posted ${result.posted.join(", ")}.`;
    });

  const deleteVoucher = (voucher: Voucher) =>
    run(voucher.txNo, async () => {
      await del(`/api/vouchers/${voucher.txNo}`);
      return `Draft ${voucher.txNo} deleted.`;
    });

  return (
    <div className="space-y-4">
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {loadError && <Banner tone="error">Could not load vouchers.</Banner>}

      <Card
        title="Store Vouchers"
        description="Drafts hold no stock. Posting writes the ledger and updates balances."
        actions={
          <div className="w-40">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft only</option>
              <option value="POSTED">Posted only</option>
            </Select>
          </div>
        }
      >
        {!vouchers ? (
          <EmptyState>Loading...</EmptyState>
        ) : vouchers.length === 0 ? (
          <EmptyState>No vouchers yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Tx No</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Warehouse</th>
                  <th className="py-2 pr-4">Transfer Ref</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <Fragment key={voucher.txNo}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          className="font-mono text-xs text-blue-700 hover:underline"
                          onClick={() =>
                            setExpanded(expanded === voucher.txNo ? null : voucher.txNo)
                          }
                        >
                          {voucher.txNo}
                        </button>
                      </td>
                      <td className="py-2 pr-4">{voucher.typeLabel}</td>
                      <td className="py-2 pr-4">{voucher.store.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                        {voucher.transferRef ?? "-"}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{formatDateTime(voucher.date)}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={voucher.status} />
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatMoney(voucher.total)}
                      </td>
                      <td className="py-2 text-right">
                        {voucher.status === "DRAFT" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              disabled={busy === voucher.txNo}
                              onClick={() => void postVoucher(voucher)}
                            >
                              Post
                            </Button>
                            <Button
                              variant="danger"
                              disabled={busy === voucher.txNo}
                              onClick={() => void deleteVoucher(voucher)}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            by {voucher.postedUid ?? "system"}
                          </span>
                        )}
                      </td>
                    </tr>

                    {expanded === voucher.txNo && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={8} className="px-4 py-3">
                          {voucher.note && (
                            <p className="mb-2 text-xs text-gray-600">Note: {voucher.note}</p>
                          )}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-1 pr-4">SKU</th>
                                <th className="py-1 pr-4">Product</th>
                                <th className="py-1 pr-4 text-right">Qty</th>
                                <th className="py-1 pr-4 text-right">Unit Cost</th>
                                <th className="py-1 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {voucher.lines.map((line) => (
                                <tr key={line.id} className="border-t border-gray-200">
                                  <td className="py-1.5 pr-4 font-mono text-xs">{line.sku}</td>
                                  <td className="py-1.5 pr-4">{line.productName}</td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums">
                                    {line.qty}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums">
                                    {formatMoney(line.unitCost)}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {formatMoney(line.lineTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
