import { MovementsView } from "@/components/movements-view";

export default function MovementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Stock Movements</h1>
        <p className="mt-1 text-sm text-gray-600">
          The audit trail. Balances can be rebuilt entirely from these rows.
        </p>
      </div>
      <MovementsView />
    </div>
  );
}
