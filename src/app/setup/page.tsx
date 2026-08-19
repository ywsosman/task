import { SetupView } from "@/components/setup-view";

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-gray-600">
          Master data: products, warehouses, groups and units.
        </p>
      </div>
      <SetupView />
    </div>
  );
}
