"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Banner, Button, Card, Field, Input, Select } from "@/components/ui";
import { ApiError, get, post, type Group, type Product, type Unit, type Warehouse } from "@/lib/client";

export function SetupView() {
  const { data: groups } = useSWR<Group[]>("/api/groups", get);
  const { data: units } = useSWR<Unit[]>("/api/units", get);
  const { data: warehouses } = useSWR<Warehouse[]>("/api/warehouses", get);
  const { data: products } = useSWR<Product[]>("/api/products", get);
  const { mutate } = useSWRConfig();

  const [message, setMessage] = useState<string | null>(null);

  async function afterCreate(text: string) {
    setMessage(text);
    await mutate((key) => typeof key === "string" && key.startsWith("/api/"));
  }

  return (
    <div className="space-y-6">
      {message && <Banner tone="success">{message}</Banner>}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductForm groups={groups ?? []} units={units ?? []} onCreated={afterCreate} />
        <WarehouseForm onCreated={afterCreate} />
        <CodeNameForm
          title="Create Group"
          description="Product classification, e.g. RAW / Raw Materials."
          endpoint="/api/groups"
          onCreated={afterCreate}
        />
        <CodeNameForm
          title="Create Unit"
          description="Unit of measure, e.g. BX / Box."
          endpoint="/api/units"
          onCreated={afterCreate}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Warehouses" description={`${warehouses?.length ?? 0} defined`}>
          <ReferenceList
            rows={(warehouses ?? []).map((warehouse) => ({
              code: warehouse.store,
              name: warehouse.name,
            }))}
          />
        </Card>
        <Card title="Products" description={`${products?.length ?? 0} defined`}>
          <ReferenceList
            rows={(products ?? []).map((product) => ({
              code: product.sku,
              name: product.nameEn,
            }))}
          />
        </Card>
        <Card title="Groups" description={`${groups?.length ?? 0} defined`}>
          <ReferenceList rows={groups ?? []} />
        </Card>
        <Card title="Units" description={`${units?.length ?? 0} defined`}>
          <ReferenceList rows={units ?? []} />
        </Card>
      </div>
    </div>
  );
}

function ReferenceList({ rows }: { rows: Array<{ code: string; name: string }> }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Nothing yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((row) => (
        <li key={row.code} className="flex gap-3">
          <span className="w-24 shrink-0 font-mono text-xs text-gray-500">{row.code}</span>
          <span>{row.name}</span>
        </li>
      ))}
    </ul>
  );
}

function useSubmit(onCreated: (message: string) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      await onCreated(message);
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}

function ProductForm({
  groups,
  units,
  onCreated,
}: {
  groups: Group[];
  units: Unit[];
  onCreated: (message: string) => Promise<void>;
}) {
  const [sku, setSku] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [unitId, setUnitId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const { busy, error, run } = useSubmit(onCreated);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await run(async () => {
      await post("/api/products", {
        sku,
        nameEn,
        nameAr,
        unitId: Number(unitId),
        groupId: Number(groupId),
        unitCost: Number(unitCost) || 0,
      });
      return `Product ${sku} created.`;
    });

    if (created) {
      setSku("");
      setNameEn("");
      setNameAr("");
      setUnitCost("0");
    }
  }

  const ready = groups.length > 0 && units.length > 0;

  return (
    <Card title="Create Product" description="A product needs a unit and a group.">
      <form className="space-y-3" onSubmit={submit}>
        <Field label="SKU">
          <Input required value={sku} onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Name (English)">
          <Input required value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
        </Field>
        <Field label="Name (Arabic)">
          <Input
            required
            dir="rtl"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit">
            <Select required value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="">Select...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Group">
            <Select required value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              <option value="">Select...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} - {group.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Default unit cost" hint="Suggested cost when adding stock.">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </Field>
        {!ready && <Banner tone="error">Create at least one group and one unit first.</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" disabled={busy || !ready}>
          {busy ? "Saving..." : "Create Product"}
        </Button>
      </form>
    </Card>
  );
}

function WarehouseForm({ onCreated }: { onCreated: (message: string) => Promise<void> }) {
  const [store, setStore] = useState("");
  const [name, setName] = useState("");
  const { busy, error, run } = useSubmit(onCreated);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await run(async () => {
      await post("/api/warehouses", { store, name });
      return `Warehouse ${store} created.`;
    });
    if (created) {
      setStore("");
      setName("");
    }
  }

  return (
    <Card title="Create Warehouse" description="Stores that hold stock.">
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Store code" hint="Short code, e.g. MAIN.">
          <Input required value={store} onChange={(event) => setStore(event.target.value)} />
        </Field>
        <Field label="Name">
          <Input required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Create Warehouse"}
        </Button>
      </form>
    </Card>
  );
}

function CodeNameForm({
  title,
  description,
  endpoint,
  onCreated,
}: {
  title: string;
  description: string;
  endpoint: string;
  onCreated: (message: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const { busy, error, run } = useSubmit(onCreated);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await run(async () => {
      await post(endpoint, { code, name });
      return `${code} created.`;
    });
    if (created) {
      setCode("");
      setName("");
    }
  }

  return (
    <Card title={title} description={description}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Code">
          <Input required value={code} onChange={(event) => setCode(event.target.value)} />
        </Field>
        <Field label="Name">
          <Input required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : title}
        </Button>
      </form>
    </Card>
  );
}
