const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL  ${label}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function api(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function main() {
  console.log(`Running smoke test against ${BASE}\n`);

  const [{ payload: warehouses }, { payload: groups }, { payload: units }] = await Promise.all([
    api("GET", "/api/warehouses"),
    api("GET", "/api/groups"),
    api("GET", "/api/units"),
  ]);

  if (!warehouses?.length || warehouses.length < 2 || !groups?.length || !units?.length) {
    throw new Error(
      "Needs at least two warehouses, one group and one unit. Run: npm run db:seed",
    );
  }

  const [source, destination] = warehouses;

  const { payload: product, status: createStatus } = await api("POST", "/api/products", {
    sku: `SMOKE-${Date.now()}`,
    nameEn: "Smoke Test Product",
    nameAr: "منتج اختبار",
    unitId: units[0].id,
    groupId: groups[0].id,
    unitCost: 50,
  });
  if (createStatus !== 201) {
    throw new Error(`Could not create the test product: ${JSON.stringify(product)}`);
  }

  const balanceFor = async (storeId) => {
    const { payload } = await api("GET", `/api/products/${product.id}/balances`);
    return payload.find((row) => row.storeId === storeId);
  };

  const createVoucher = (storeId, type, lines) =>
    api("POST", "/api/vouchers", { storeId, type, lines });

  console.log("1. A draft voucher must not move stock");
  const draft = await createVoucher(source.id, 1, [
    { productId: product.id, qty: 100, unitCost: 50 },
  ]);
  check("draft created", draft.status, 201);
  check("status is DRAFT", draft.payload.status, "DRAFT");
  check("stock still zero while draft", (await balanceFor(source.id)).qty, 0);

  console.log("2. Posting the inbound voucher adds stock at its cost");
  const posted = await api("POST", `/api/vouchers/${draft.payload.txNo}/post`);
  check("post succeeded", posted.status, 200);
  const afterIn = await balanceFor(source.id);
  check("qty is 100", afterIn.qty, 100);
  check("average cost is 50", afterIn.avgCost, 50);

  console.log("3. Re-posting the same voucher is rejected");
  const rePost = await api("POST", `/api/vouchers/${draft.payload.txNo}/post`);
  check("second post rejected", rePost.status, 409);
  check("error code", rePost.payload.error.code, "INVALID_STATE");

  console.log("4. A second receipt blends into a weighted average cost");
  const second = await createVoucher(source.id, 1, [
    { productId: product.id, qty: 100, unitCost: 60 },
  ]);
  await api("POST", `/api/vouchers/${second.payload.txNo}/post`);
  const afterSecond = await balanceFor(source.id);
  check("qty is 200", afterSecond.qty, 200);
  check("average cost is 55", afterSecond.avgCost, 55);

  console.log("5. Issuing stock leaves the average cost untouched");
  const issue = await createVoucher(source.id, 2, [{ productId: product.id, qty: 50 }]);
  await api("POST", `/api/vouchers/${issue.payload.txNo}/post`);
  const afterOut = await balanceFor(source.id);
  check("qty is 150", afterOut.qty, 150);
  check("average cost still 55", afterOut.avgCost, 55);

  console.log("6. Issuing more than is on hand is refused");
  const oversell = await createVoucher(source.id, 2, [{ productId: product.id, qty: 100000 }]);
  const oversellPost = await api("POST", `/api/vouchers/${oversell.payload.txNo}/post`);
  check("rejected with 409", oversellPost.status, 409);
  check("error code", oversellPost.payload.error.code, "INSUFFICIENT_STOCK");
  check("stock untouched after failure", (await balanceFor(source.id)).qty, 150);

  console.log("7. A transfer moves both warehouses in one transaction");
  const transfer = await api("POST", "/api/transfers", {
    fromStoreId: source.id,
    toStoreId: destination.id,
    lines: [{ productId: product.id, qty: 50 }],
  });
  check("transfer drafted", transfer.status, 201);
  check("both legs still draft", transfer.payload.outLeg.status, "DRAFT");
  check("source unchanged while draft", (await balanceFor(source.id)).qty, 150);

  const transferPost = await api("POST", `/api/transfers/${transfer.payload.transferRef}/post`);
  check("transfer posted", transferPost.status, 200);
  check("two legs posted", transferPost.payload.posted.length, 2);
  check("source reduced to 100", (await balanceFor(source.id)).qty, 100);

  const destinationAfter = await balanceFor(destination.id);
  check("destination raised to 50", destinationAfter.qty, 50);
  check("cost travelled with the goods", destinationAfter.avgCost, 55);

  console.log("8. A transfer that exceeds available stock rolls back both sides");
  const badTransfer = await api("POST", "/api/transfers", {
    fromStoreId: source.id,
    toStoreId: destination.id,
    lines: [{ productId: product.id, qty: 99999 }],
  });
  const badPost = await api("POST", `/api/transfers/${badTransfer.payload.transferRef}/post`);
  check("rejected with 409", badPost.status, 409);
  check("source unchanged", (await balanceFor(source.id)).qty, 100);
  check("destination unchanged", (await balanceFor(destination.id)).qty, 50);

  console.log("9. Validation rejects bad input");
  const zeroQty = await createVoucher(source.id, 1, [{ productId: product.id, qty: 0 }]);
  check("zero quantity rejected", zeroQty.status, 400);

  const sameStore = await api("POST", "/api/transfers", {
    fromStoreId: source.id,
    toStoreId: source.id,
    lines: [{ productId: product.id, qty: 1 }],
  });
  check("transfer to the same store rejected", sameStore.status, 400);

  console.log("10. Product total matches the sum of its warehouses");
  const { payload: products } = await api("GET", "/api/products");
  check("onHandQty is 150", products.find((item) => item.id === product.id).onHandQty, 150);

  console.log("11. Every posted line is in the ledger with a signed quantity");
  const { payload: movements } = await api("GET", `/api/movements?productId=${product.id}`);
  check("ledger nets to 150", movements.reduce((sum, row) => sum + row.qty, 0), 150);
  check("outbound rows are negative", movements.some((row) => row.qty < 0), true);
  check("failed and draft vouchers wrote no rows", movements.length, 5);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
