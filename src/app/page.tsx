import { ProductsView } from "@/components/products-view";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Products &amp; Stock</h1>
        <p className="mt-1 text-sm text-gray-600">
          Stock only moves when a voucher is posted. Saving a draft records the document
          without touching balances.
        </p>
      </div>
      <ProductsView />
    </div>
  );
}
