import { VouchersView } from "@/components/vouchers-view";

export default function VouchersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Store Vouchers</h1>
        <p className="mt-1 text-sm text-gray-600">
          SVI documents bring stock in, SVO documents take it out. A transfer is one SVO and
          one SVI sharing an SVT reference, and posting either one posts both.
        </p>
      </div>
      <VouchersView />
    </div>
  );
}
