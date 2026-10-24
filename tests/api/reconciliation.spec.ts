import { test, expect } from "@playwright/test";
import { pay, validBody } from "./helpers";

test.describe("Reconciliation", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/admin/reset");
  });

  test("payments and ledger agree after mixed activity", async ({ request }) => {
    const a = await (await pay(request)).json();
    await pay(request, { ...validBody, card: "4000000000000002" }); // declined
    await request.post(`/payments/${a.id}/refunds`, { data: { amount: 10000 } });

    const res = await request.get("/admin/reconciliation");
    expect((await res.json()).mismatches).toEqual([]);
  });

  test("detects a payment whose ledger charge is missing", async ({ request }) => {
    const p = await (await pay(request)).json();
    await request.delete(`/admin/ledger/${p.id}`); // simulate the bug

    const res = await request.get("/admin/reconciliation");
    const { mismatches } = await res.json();

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].id).toBe(p.id);
    expect(mismatches[0].charged).toBe(0);
    expect(mismatches[0].amount).toBe(50000);
  });
});